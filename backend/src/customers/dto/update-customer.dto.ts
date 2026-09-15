import { IsEmail, IsOptional, IsString, Length } from 'class-validator';

export class UpdateCustomerDto {
  @IsOptional()
  @IsString()
  @Length(2, 150)
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @Length(1, 150)
  company?: string;
}
