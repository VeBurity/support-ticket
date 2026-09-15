import { IsEnum } from 'class-validator';
import { TicketStatus } from '@prisma/client';

export class ChangeTicketStatusDto {
  @IsEnum(TicketStatus)
  status: TicketStatus;
}
