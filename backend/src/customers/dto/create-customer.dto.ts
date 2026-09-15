import { IsEmail, IsOptional, IsString, Length } from 'class-validator';

export class CreateCustomerDto {
  @IsString()
  @Length(2, 150)
  name: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  @Length(1, 150)
  company?: string;
}
