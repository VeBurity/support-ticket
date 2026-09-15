import { IsEmail, IsEnum, IsString, Length } from 'class-validator';
import { Role } from '@prisma/client';

export class CreateUserDto {
  @IsString()
  @Length(2, 100)
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @Length(8, 100)
  password: string;

  @IsEnum(Role)
  role: Role;
}
