import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AppException } from '../common/errors/app.exception';
import { AuthenticatedUser } from '../common/guards/jwt-auth.guard';

export interface AccessTokenPayload {
  sub: string;
  role: string;
  tokenVersion: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  async validate(payload: AccessTokenPayload): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user) {
      throw new AppException('AUTH_TOKEN_INVALID', 'Token inválido.');
    }

    if (user.tokenVersion !== payload.tokenVersion) {
      throw new AppException('AUTH_TOKEN_INVALID', 'Token inválido.');
    }

    if (user.status === 'BLOCKED') {
      throw new AppException('AUTH_USER_BLOCKED', 'Usuario bloqueado.');
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tokenVersion: user.tokenVersion,
    };
  }
}
