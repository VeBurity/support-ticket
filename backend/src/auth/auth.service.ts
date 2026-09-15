import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomUUID, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AppException } from '../common/errors/app.exception';
import { parseDurationToMs } from '../common/utils/duration.util';
import { toPublicUser, PublicUser } from '../users/user.mapper';

interface LoginResult {
  accessToken: string;
  user: PublicUser;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

interface RefreshResult {
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(email: string, password: string): Promise<LoginResult> {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) {
      throw new AppException(
        'AUTH_INVALID_CREDENTIALS',
        'Credenciales inválidas.',
      );
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      throw new AppException(
        'AUTH_INVALID_CREDENTIALS',
        'Credenciales inválidas.',
      );
    }

    if (user.status === 'BLOCKED') {
      throw new AppException('AUTH_USER_BLOCKED', 'Usuario bloqueado.');
    }

    const accessToken = await this.signAccessToken(
      user.id,
      user.role,
      user.tokenVersion,
    );
    const { refreshToken, refreshTokenExpiresAt } =
      await this.issueRefreshToken(user.id);

    return {
      accessToken,
      user: toPublicUser(user),
      refreshToken,
      refreshTokenExpiresAt,
    };
  }

  async refresh(refreshTokenCookie: string | undefined): Promise<RefreshResult> {
    const parsed = this.parseRefreshToken(refreshTokenCookie);
    if (!parsed) {
      throw new AppException('AUTH_TOKEN_INVALID', 'Token inválido.');
    }

    const record = await this.prisma.refreshToken.findUnique({
      where: { id: parsed.id },
      include: { user: true },
    });

    if (!record || record.revokedAt || record.expiresAt < new Date()) {
      throw new AppException('AUTH_TOKEN_INVALID', 'Token inválido.');
    }

    const secretMatches = await bcrypt.compare(
      parsed.secret,
      record.tokenHash,
    );
    if (!secretMatches) {
      throw new AppException('AUTH_TOKEN_INVALID', 'Token inválido.');
    }

    if (record.user.status === 'BLOCKED') {
      throw new AppException('AUTH_USER_BLOCKED', 'Usuario bloqueado.');
    }

    const { id, refreshToken, refreshTokenExpiresAt, tokenHash } =
      await this.buildRefreshToken(record.userId);

    await this.prisma.$transaction([
      this.prisma.refreshToken.update({
        where: { id: record.id },
        data: { revokedAt: new Date(), replacedByHash: tokenHash },
      }),
      this.prisma.refreshToken.create({
        data: {
          id,
          userId: record.userId,
          tokenHash,
          expiresAt: refreshTokenExpiresAt,
        },
      }),
    ]);

    const accessToken = await this.signAccessToken(
      record.user.id,
      record.user.role,
      record.user.tokenVersion,
    );

    return { accessToken, refreshToken, refreshTokenExpiresAt };
  }

  async logout(refreshTokenCookie: string | undefined): Promise<void> {
    const parsed = this.parseRefreshToken(refreshTokenCookie);
    if (!parsed) {
      return;
    }

    await this.prisma.refreshToken.updateMany({
      where: { id: parsed.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async me(userId: string): Promise<PublicUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new AppException('USER_NOT_FOUND', 'Usuario no encontrado.');
    }
    return toPublicUser(user);
  }

  private async signAccessToken(
    userId: string,
    role: string,
    tokenVersion: number,
  ): Promise<string> {
    return this.jwt.signAsync(
      { sub: userId, role, tokenVersion },
      {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.config.getOrThrow<string>(
          'JWT_ACCESS_EXPIRES',
        ) as JwtSignOptions['expiresIn'],
      },
    );
  }

  private async issueRefreshToken(userId: string) {
    const { id, refreshToken, refreshTokenExpiresAt, tokenHash } =
      await this.buildRefreshToken(userId);

    await this.prisma.refreshToken.create({
      data: { id, userId, tokenHash, expiresAt: refreshTokenExpiresAt },
    });

    return { refreshToken, refreshTokenExpiresAt };
  }

  private async buildRefreshToken(userId: string) {
    const id = randomUUID();
    const secret = randomBytes(32).toString('hex');
    const saltRounds = Number(this.config.get('BCRYPT_SALT_ROUNDS') ?? 10);
    const tokenHash = await bcrypt.hash(secret, saltRounds);
    const ttlMs = parseDurationToMs(
      this.config.get<string>('JWT_REFRESH_EXPIRES') ?? '7d',
    );
    const refreshTokenExpiresAt = new Date(Date.now() + ttlMs);

    return {
      id,
      refreshToken: `${id}.${secret}`,
      refreshTokenExpiresAt,
      tokenHash,
      userId,
    };
  }

  private parseRefreshToken(
    raw: string | undefined,
  ): { id: string; secret: string } | null {
    if (!raw) {
      return null;
    }
    const [id, secret] = raw.split('.');
    if (!id || !secret) {
      return null;
    }
    return { id, secret };
  }
}
