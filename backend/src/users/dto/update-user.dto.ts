import { IsEnum, IsOptional, IsString, Length } from 'class-validator';
import { Role } from '@prisma/client';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @Length(2, 100)
  name?: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}
