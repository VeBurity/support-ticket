import { IsEnum, IsOptional } from 'class-validator';
import { Role, UserStatus } from '@prisma/client';

export class ListUsersQueryDto {
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}
