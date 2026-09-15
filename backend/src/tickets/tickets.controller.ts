import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { ChangeTicketStatusDto } from './dto/change-ticket-status.dto';
import { AssignTicketDto } from './dto/assign-ticket.dto';
import { ListTicketsQueryDto } from './dto/list-tickets-query.dto';
import { CreateCommentDto } from './comments/dto/create-comment.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/guards/jwt-auth.guard';

@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListTicketsQueryDto,
  ) {
    return this.ticketsService.list(user, query);
  }

  @Roles('ADMIN', 'AGENT')
  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTicketDto,
  ) {
    return this.ticketsService.create(user, dto);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.ticketsService.findOneScoped(user, id);
  }

  @Roles('ADMIN', 'AGENT')
  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateTicketDto,
  ) {
    return this.ticketsService.update(user, id, dto);
  }

  @Roles('ADMIN', 'AGENT')
  @Patch(':id/status')
  changeStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ChangeTicketStatusDto,
  ) {
    return this.ticketsService.changeStatus(user, id, dto);
  }

  @Roles('ADMIN', 'SUPERVISOR')
  @Patch(':id/assign')
  assign(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AssignTicketDto,
  ) {
    return this.ticketsService.assign(user, id, dto);
  }

  @Post(':id/comments')
  addComment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.ticketsService.addComment(user, id, dto.body, dto.isInternal);
  }

  @Get(':id/history')
  history(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.ticketsService.history(user, id);
  }
}
