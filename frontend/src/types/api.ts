export type Role = 'ADMIN' | 'AGENT' | 'SUPERVISOR';
export type UserStatus = 'ACTIVE' | 'BLOCKED';

export type TicketStatus =
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'PENDING_CUSTOMER'
  | 'RESOLVED'
  | 'CLOSED';

export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type TicketChannel = 'WEB' | 'EMAIL' | 'PHONE' | 'MANUAL';
export type TicketCategory =
  | 'BILLING'
  | 'TECHNICAL_SUPPORT'
  | 'ACCESS'
  | 'OTHER';

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'AUTH_INVALID_CREDENTIALS'
  | 'AUTH_USER_BLOCKED'
  | 'AUTH_TOKEN_EXPIRED'
  | 'AUTH_TOKEN_INVALID'
  | 'FORBIDDEN_ROLE'
  | 'FORBIDDEN_OWNERSHIP'
  | 'INVALID_STATUS_TRANSITION'
  | 'TICKET_NOT_FOUND'
  | 'CUSTOMER_NOT_FOUND'
  | 'USER_NOT_FOUND'
  | 'INTERNAL_ERROR';

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: UserStatus;
  createdAt: string;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  company: string | null;
  createdAt: string;
}

export interface UserRef {
  id: string;
  name: string;
  email?: string;
}

export interface TicketComment {
  id: string;
  ticketId: string;
  authorId: string;
  body: string;
  isInternal: boolean;
  createdAt: string;
}

export interface TicketListItem {
  id: string;
  sequence: number;
  folio: string;
  customerId: string;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  category: TicketCategory;
  channel: TicketChannel;
  assignedToId: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  slaDueAt: string;
  reassignmentCount: number;
  customer: { id: string; name: string; email: string };
  assignedTo: UserRef | null;
}

export interface TicketDetail extends TicketListItem {
  createdBy: UserRef;
  comments: TicketComment[];
}

export type TicketHistoryEvent =
  | {
      type: 'STATUS_CHANGE';
      at: string;
      fromStatus: TicketStatus | null;
      toStatus: TicketStatus;
      changedBy: UserRef;
    }
  | {
      type: 'ASSIGNMENT';
      at: string;
      fromUser: UserRef | null;
      toUser: UserRef | null;
      changedBy: UserRef;
    };

export interface PaginatedTickets {
  data: TicketListItem[];
  meta: { nextCursor: string | null; limit: number };
}

export interface StaffDashboardMetrics {
  byStatus: Record<TicketStatus, number>;
  byPriority: Record<TicketPriority, number>;
  overdueCount: number;
  avgResolutionHours: number | null;
  byAgent: { agentId: string; agentName: string; count: number }[];
}

export interface AgentDashboardMetrics {
  byStatus: Record<TicketStatus, number>;
  overdueCount: number;
  unassignedCount: number;
}

export type DashboardMetrics = StaffDashboardMetrics | AgentDashboardMetrics;

export function isStaffMetrics(
  metrics: DashboardMetrics,
): metrics is StaffDashboardMetrics {
  return 'byAgent' in metrics;
}
