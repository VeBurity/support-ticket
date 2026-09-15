import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/guards/jwt-auth.guard';

const REFRESH_COOKIE_NAME = 'refresh_token';
const REFRESH_COOKIE_PATH = '/api/v1/auth/refresh';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, user, refreshToken, refreshTokenExpiresAt } =
      await this.authService.login(dto.email, dto.password);

    this.setRefreshCookie(res, refreshToken, refreshTokenExpiresAt);

    return { accessToken, user };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const cookie = req.cookies?.[REFRESH_COOKIE_NAME];
    const { accessToken, refreshToken, refreshTokenExpiresAt } =
      await this.authService.refresh(cookie);

    this.setRefreshCookie(res, refreshToken, refreshTokenExpiresAt);

    return { accessToken };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const cookie = req.cookies?.[REFRESH_COOKIE_NAME];
    await this.authService.logout(cookie);
    res.clearCookie(REFRESH_COOKIE_NAME, { path: REFRESH_COOKIE_PATH });
    return null;
  }

  @Get('me')
  async me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.me(user.id);
  }

  private setRefreshCookie(
    res: Response,
    refreshToken: string,
    expiresAt: Date,
  ) {
    res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: REFRESH_COOKIE_PATH,
      expires: expiresAt,
    });
  }
}
