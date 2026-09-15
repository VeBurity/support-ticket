import { Injectable } from '@nestjs/common';
import { TicketPriority, TicketStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../common/guards/jwt-auth.guard';

const ALL_STATUSES: TicketStatus[] = [
  'OPEN',
  'IN_PROGRESS',
  'PENDING_CUSTOMER',
  'RESOLVED',
  'CLOSED',
];

const ALL_PRIORITIES: TicketPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

const OPEN_STATUSES: TicketStatus[] = [
  'OPEN',
  'IN_PROGRESS',
  'PENDING_CUSTOMER',
  'RESOLVED',
];

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async metrics(user: AuthenticatedUser) {
    if (user.role === 'AGENT') {
      return this.agentMetrics(user);
    }
    return this.staffMetrics();
  }

  private async agentMetrics(user: AuthenticatedUser) {
    const [byStatus, overdueCount, unassignedCount] = await Promise.all([
      this.groupByStatus({ assignedToId: user.id }),
      this.prisma.ticket.count({
        where: {
          assignedToId: user.id,
          status: { notIn: ['RESOLVED', 'CLOSED'] },
          slaDueAt: { lt: new Date() },
        },
      }),
      this.prisma.ticket.count({ where: { assignedToId: null } }),
    ]);

    return { byStatus, overdueCount, unassignedCount };
  }

  private async staffMetrics() {
    const [byStatus, byPriority, overdueCount, avgResolutionHours, byAgentRaw] =
      await Promise.all([
        this.groupByStatus({}),
        this.groupByPriority(),
        this.prisma.ticket.count({
          where: {
            status: { notIn: ['RESOLVED', 'CLOSED'] },
            slaDueAt: { lt: new Date() },
          },
        }),
        this.averageResolutionHours(),
        this.prisma.ticket.groupBy({
          by: ['assignedToId'],
          where: { assignedToId: { not: null }, status: { in: OPEN_STATUSES } },
          _count: { _all: true },
        }),
      ]);

    const agentIds = byAgentRaw
      .map((row) => row.assignedToId)
      .filter((id): id is string => id !== null);

    const agents = agentIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: agentIds } },
          select: { id: true, name: true },
        })
      : [];
    const agentNameById = new Map(agents.map((a) => [a.id, a.name]));

    const byAgent = byAgentRaw.map((row) => ({
      agentId: row.assignedToId as string,
      agentName: agentNameById.get(row.assignedToId as string) ?? '—',
      count: row._count._all,
    }));

    return { byStatus, byPriority, overdueCount, avgResolutionHours, byAgent };
  }

  private async groupByStatus(
    extraWhere: Record<string, unknown>,
  ): Promise<Record<TicketStatus, number>> {
    const rows = await this.prisma.ticket.groupBy({
      by: ['status'],
      where: extraWhere,
      _count: { _all: true },
    });
    const result = Object.fromEntries(
      ALL_STATUSES.map((status) => [status, 0]),
    ) as Record<TicketStatus, number>;
    for (const row of rows) {
      result[row.status] = row._count._all;
    }
    return result;
  }

  private async groupByPriority(): Promise<Record<TicketPriority, number>> {
    const rows = await this.prisma.ticket.groupBy({
      by: ['priority'],
      _count: { _all: true },
    });
    const result = Object.fromEntries(
      ALL_PRIORITIES.map((priority) => [priority, 0]),
    ) as Record<TicketPriority, number>;
    for (const row of rows) {
      result[row.priority] = row._count._all;
    }
    return result;
  }

  private async averageResolutionHours(): Promise<number | null> {
    const rows = await this.prisma.$queryRaw<{ avg_hours: number | null }[]>`
      SELECT AVG(EXTRACT(EPOCH FROM ("closedAt" - "createdAt")) / 3600) AS avg_hours
      FROM tickets
      WHERE status = 'CLOSED'
        AND "closedAt" IS NOT NULL
        AND "closedAt" >= NOW() - INTERVAL '30 days'
    `;
    const value = rows[0]?.avg_hours;
    return value === null || value === undefined ? null : Number(value);
  }
}
