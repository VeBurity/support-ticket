import {
  IsEnum,
  IsOptional,
  IsUUID,
  Length,
} from 'class-validator';
import {
  TicketCategory,
  TicketChannel,
  TicketPriority,
} from '@prisma/client';

export class CreateTicketDto {
  @IsUUID()
  customerId: string;

  @Length(5, 150)
  title: string;

  @Length(10, 5000)
  description: string;

  @IsEnum(TicketPriority)
  priority: TicketPriority;

  @IsEnum(TicketCategory)
  category: TicketCategory;

  @IsOptional()
  @IsEnum(TicketChannel)
  channel?: TicketChannel;
}
