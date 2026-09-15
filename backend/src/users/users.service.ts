import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AppException } from '../common/errors/app.exception';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { toPublicUser, PublicUser } from './user.mapper';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async list(filters: ListUsersQueryDto): Promise<PublicUser[]> {
    const users = await this.prisma.user.findMany({
      where: {
        role: filters.role,
        status: filters.status,
      },
      orderBy: { createdAt: 'desc' },
    });
    return users.map(toPublicUser);
  }

  async create(dto: CreateUserDto): Promise<PublicUser> {
    const saltRounds = Number(this.config.get('BCRYPT_SALT_ROUNDS') ?? 10);
    const passwordHash = await bcrypt.hash(dto.password, saltRounds);

    try {
      const user = await this.prisma.user.create({
        data: {
          name: dto.name,
          email: dto.email,
          passwordHash,
          role: dto.role,
        },
      });
      return toPublicUser(user);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new AppException(
          'VALIDATION_ERROR',
          'El email ya está en uso.',
        );
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateUserDto): Promise<PublicUser> {
    await this.findOrThrow(id);
    const user = await this.prisma.user.update({
      where: { id },
      data: { name: dto.name, role: dto.role },
    });
    return toPublicUser(user);
  }

  async updateStatus(
    id: string,
    dto: UpdateUserStatusDto,
  ): Promise<PublicUser> {
    const existing = await this.findOrThrow(id);

    const shouldInvalidateSessions =
      dto.status === 'BLOCKED' && existing.status !== 'BLOCKED';

    const user = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data: {
          status: dto.status,
          ...(shouldInvalidateSessions
            ? { tokenVersion: { increment: 1 } }
            : {}),
        },
      });

      if (shouldInvalidateSessions) {
        await tx.refreshToken.updateMany({
          where: { userId: id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }

      return updated;
    });

    return toPublicUser(user);
  }

  private async findOrThrow(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new AppException('USER_NOT_FOUND', 'Usuario no encontrado.');
    }
    return user;
  }
}
