import { IsBoolean, IsOptional, Length } from 'class-validator';

export class CreateCommentDto {
  @Length(1, 3000)
  body: string;

  @IsOptional()
  @IsBoolean()
  isInternal?: boolean;
}
