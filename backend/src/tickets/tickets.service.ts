import { Injectable } from '@nestjs/common';
import { Prisma, TicketStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AppException } from '../common/errors/app.exception';
import { AuthenticatedUser } from '../common/guards/jwt-auth.guard';
import { encodeCursor, decodeCursor } from '../common/utils/cursor.util';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { ChangeTicketStatusDto } from './dto/change-ticket-status.dto';
import { AssignTicketDto } from './dto/assign-ticket.dto';
import { ListTicketsQueryDto } from './dto/list-tickets-query.dto';
import { computeSlaDueAt } from './sla.util';
import { canTransitionTicketStatus } from './ticket-state-machine';
import { ticketVisibilityWhere, isTicketOwner } from './ticket-scope.util';

const TICKET_DETAIL_INCLUDE = {
  customer: true,
  assignedTo: { select: { id: true, name: true, email: true } },
  createdBy: { select: { id: true, name: true, email: true } },
  comments: { orderBy: { createdAt: 'asc' as const } },
} satisfies Prisma.TicketInclude;

@Injectable()
export class TicketsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: AuthenticatedUser, filters: ListTicketsQueryDto) {
    const limit = filters.limit ?? 20;
    const scopeWhere = ticketVisibilityWhere(user);

    const where: Prisma.TicketWhereInput = {
      AND: [
        scopeWhere ?? {},
        filters.status ? { status: filters.status } : {},
        filters.priority ? { priority: filters.priority } : {},
        filters.customerId ? { customerId: filters.customerId } : {},
        filters.assignedToId ? { assignedToId: filters.assignedToId } : {},
        filters.category ? { category: filters.category } : {},
        filters.dateFrom ? { createdAt: { gte: new Date(filters.dateFrom) } } : {},
        filters.dateTo ? { createdAt: { lte: new Date(filters.dateTo) } } : {},
        filters.q
          ? { title: { contains: filters.q, mode: 'insensitive' } }
          : {},
        filters.overdue
          ? {
              slaDueAt: { lt: new Date() },
              status: { notIn: ['RESOLVED', 'CLOSED'] as TicketStatus[] },
            }
          : {},
      ],
    };

    const items = await this.prisma.ticket.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(filters.cursor
        ? { cursor: { id: decodeCursor(filters.cursor) }, skip: 1 }
        : {}),
      include: {
        customer: { select: { id: true, name: true, email: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
      },
    });

    const hasMore = items.length > limit;
    const page = hasMore ? items.slice(0, limit) : items;
    const nextCursor = hasMore ? encodeCursor(page[page.length - 1].id) : null;

    return {
      data: page,
      meta: { nextCursor, limit },
    };
  }

  async findOneScoped(user: AuthenticatedUser, id: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      include: TICKET_DETAIL_INCLUDE,
    });

    if (!ticket || !this.isWithinScope(user, ticket)) {
      throw new AppException('TICKET_NOT_FOUND', 'Ticket no encontrado.');
    }

    return ticket;
  }

  async create(user: AuthenticatedUser, dto: CreateTicketDto) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: dto.customerId },
    });
    if (!customer) {
      throw new AppException('CUSTOMER_NOT_FOUND', 'Cliente no encontrado.');
    }

    return this.prisma.$transaction(async (tx) => {
      const created = await tx.ticket.create({
        data: {
          folio: 'PENDING',
          customerId: dto.customerId,
          title: dto.title,
          description: dto.description,
          priority: dto.priority,
          category: dto.category,
          channel: dto.channel ?? 'WEB',
          createdById: user.id,
          slaDueAt: computeSlaDueAt(dto.priority),
        },
      });

      return tx.ticket.update({
        where: { id: created.id },
        data: { folio: `TCK-${String(created.sequence).padStart(5, '0')}` },
        include: TICKET_DETAIL_INCLUDE,
      });
    });
  }

  async update(user: AuthenticatedUser, id: string, dto: UpdateTicketDto) {
    const ticket = await this.getEditableTicketOrThrow(user, id);

    return this.prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        title: dto.title,
        description: dto.description,
        priority: dto.priority,
        category: dto.category,
      },
      include: TICKET_DETAIL_INCLUDE,
    });
  }

  async changeStatus(
    user: AuthenticatedUser,
    id: string,
    dto: ChangeTicketStatusDto,
  ) {
    const ticket = await this.getEditableTicketOrThrow(user, id);
    const isOwner = isTicketOwner(ticket, user);

    if (
      !canTransitionTicketStatus(ticket.status, dto.status, user.role, isOwner)
    ) {
      throw new AppException(
        'INVALID_STATUS_TRANSITION',
        `No se puede pasar de ${ticket.status} a ${dto.status}.`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.ticket.update({
        where: { id: ticket.id },
        data: {
          status: dto.status,
          closedAt: dto.status === 'CLOSED' ? new Date() : null,
        },
        include: TICKET_DETAIL_INCLUDE,
      });

      await tx.ticketStatusHistory.create({
        data: {
          ticketId: ticket.id,
          fromStatus: ticket.status,
          toStatus: dto.status,
          changedById: user.id,
        },
      });

      return updated;
    });
  }

  async assign(user: AuthenticatedUser, id: string, dto: AssignTicketDto) {
    const ticket = await this.prisma.ticket.findUnique({ where: { id } });
    if (!ticket) {
      throw new AppException('TICKET_NOT_FOUND', 'Ticket no encontrado.');
    }

    const targetUser = await this.prisma.user.findUnique({
      where: { id: dto.assignedToId },
    });
    if (!targetUser) {
      throw new AppException('USER_NOT_FOUND', 'Usuario no encontrado.');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.ticket.update({
        where: { id: ticket.id },
        data: {
          assignedToId: dto.assignedToId,
          reassignmentCount: { increment: 1 },
          slaDueAt: computeSlaDueAt(ticket.priority),
        },
        include: TICKET_DETAIL_INCLUDE,
      });

      await tx.ticketAssignmentHistory.create({
        data: {
          ticketId: ticket.id,
          fromUserId: ticket.assignedToId,
          toUserId: dto.assignedToId,
          changedById: user.id,
        },
      });

      return updated;
    });
  }

  async addComment(
    user: AuthenticatedUser,
    id: string,
    body: string,
    isInternal: boolean | undefined,
  ) {
    const ticket = await this.findOneScoped(user, id);

    if (user.role === 'AGENT' && !isTicketOwner(ticket, user)) {
      throw new AppException(
        'FORBIDDEN_OWNERSHIP',
        'Solo puedes comentar en tickets asignados a ti.',
      );
    }

    const canMarkInternal = user.role === 'ADMIN' || user.role === 'SUPERVISOR';

    return this.prisma.ticketComment.create({
      data: {
        ticketId: ticket.id,
        authorId: user.id,
        body,
        isInternal: canMarkInternal ? Boolean(isInternal) : false,
      },
    });
  }

  async history(user: AuthenticatedUser, id: string) {
    const ticket = await this.findOneScoped(user, id);

    if (user.role === 'AGENT' && !isTicketOwner(ticket, user)) {
      throw new AppException(
        'FORBIDDEN_OWNERSHIP',
        'Solo puedes ver el historial de tickets asignados a ti.',
      );
    }

    const [statusHistory, assignmentHistory] = await Promise.all([
      this.prisma.ticketStatusHistory.findMany({
        where: { ticketId: ticket.id },
        include: { changedBy: { select: { id: true, name: true } } },
      }),
      this.prisma.ticketAssignmentHistory.findMany({
        where: { ticketId: ticket.id },
        include: {
          changedBy: { select: { id: true, name: true } },
          fromUser: { select: { id: true, name: true } },
          toUser: { select: { id: true, name: true } },
        },
      }),
    ]);

    const events = [
      ...statusHistory.map((event) => ({
        type: 'STATUS_CHANGE' as const,
        at: event.changedAt,
        fromStatus: event.fromStatus,
        toStatus: event.toStatus,
        changedBy: event.changedBy,
      })),
      ...assignmentHistory.map((event) => ({
        type: 'ASSIGNMENT' as const,
        at: event.changedAt,
        fromUser: event.fromUser,
        toUser: event.toUser,
        changedBy: event.changedBy,
      })),
    ].sort((a, b) => a.at.getTime() - b.at.getTime());

    return events;
  }

  private async getEditableTicketOrThrow(user: AuthenticatedUser, id: string) {
    const ticket = await this.findOneScoped(user, id);

    if (user.role === 'AGENT' && !isTicketOwner(ticket, user)) {
      throw new AppException(
        'FORBIDDEN_OWNERSHIP',
        'Solo puedes modificar tickets asignados a ti.',
      );
    }

    return ticket;
  }

  private isWithinScope(
    user: AuthenticatedUser,
    ticket: { assignedToId: string | null },
  ): boolean {
    if (user.role === 'ADMIN' || user.role === 'SUPERVISOR') {
      return true;
    }
    return ticket.assignedToId === user.id || ticket.assignedToId === null;
  }
}
