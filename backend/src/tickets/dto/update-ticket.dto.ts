import { IsEnum, IsOptional, Length } from 'class-validator';
import { TicketCategory, TicketPriority } from '@prisma/client';

export class UpdateTicketDto {
  @IsOptional()
  @Length(5, 150)
  title?: string;

  @IsOptional()
  @Length(10, 5000)
  description?: string;

  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;

  @IsOptional()
  @IsEnum(TicketCategory)
  category?: TicketCategory;
}
