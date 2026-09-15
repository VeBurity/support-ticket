import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AppException } from '../errors/app.exception';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  tokenVersion: number;
}

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(
      IS_PUBLIC_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }

  handleRequest<TUser = AuthenticatedUser>(
    err: unknown,
    user: TUser,
    info: { name?: string } | undefined,
  ): TUser {
    if (err) {
      throw err;
    }

    if (!user) {
      if (info?.name === 'TokenExpiredError') {
        throw new AppException('AUTH_TOKEN_EXPIRED', 'El token expiró.');
      }
      throw new AppException('AUTH_TOKEN_INVALID', 'Token inválido.');
    }

    return user;
  }
}
