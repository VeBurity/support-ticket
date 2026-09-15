import { IsOptional, IsString, Length } from 'class-validator';

export class ListCustomersQueryDto {
  @IsOptional()
  @IsString()
  @Length(1, 150)
  q?: string;
}
