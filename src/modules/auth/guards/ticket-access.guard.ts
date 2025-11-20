import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { TicketRepository } from '../../support/repositories/ticket.repository';
import { AgentRepository } from '../../support/repositories/agent.repository';
import { AdminUser } from '../../../entities/admin-user.entity';

@Injectable()
export class TicketAccessGuard implements CanActivate {
  private readonly logger = new Logger(TicketAccessGuard.name);

  constructor(
    private readonly ticketRepository: TicketRepository,
    private readonly agentRepository: AgentRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user: AdminUser = request.user;
    const ticketId = request.params.id;

    if (!user) {
      this.logger.warn('No user found in request context');
      throw new ForbiddenException('User not authenticated');
    }

    if (!ticketId) {
      this.logger.warn('No ticket ID found in request parameters');
      throw new NotFoundException('Ticket ID is required');
    }

    // Fetch the ticket
    const ticket = await this.ticketRepository.findById(ticketId);
    if (!ticket) {
      this.logger.warn(`Ticket not found with id ${ticketId}`);
      throw new NotFoundException('Ticket not found');
    }

    // Validate user role and permissions
    if (!user.roleEntity) {
      this.logger.warn(`User ${user.id} has no role entity loaded`);
      throw new ForbiddenException('User role not found');
    }

    // Check if user has support resource permissions
    const supportPermission = user.roleEntity.permissions?.find(
      (perm) => perm.resource === 'support',
    );

    if (!supportPermission || !supportPermission.actions?.length) {
      this.logger.warn(
        `User ${user.id} (role: ${user.roleEntity.name}) attempted to access ticket ${ticketId} but lacks support resource permission`,
      );
      throw new ForbiddenException(
        'Insufficient permissions: Access to support resource is required',
      );
    }

    // Check if user has read permission for support resource
    const hasReadPermission = supportPermission.actions.includes('read');
    if (!hasReadPermission) {
      this.logger.warn(
        `User ${user.id} (role: ${user.roleEntity.name}) attempted to access ticket ${ticketId} but lacks read permission for support resource`,
      );
      throw new ForbiddenException(
        'Insufficient permissions: Read permission for support resource is required',
      );
    }

    // Determine if user has admin-level permissions (has write or delete actions)
    // Users with write/delete permissions can access all tickets
    const hasAdminLevelAccess =
      supportPermission.actions.includes('write') ||
      supportPermission.actions.includes('delete');

    // If user has admin-level access (write/delete permissions), they can access all tickets
    if (hasAdminLevelAccess) {
      this.logger.debug(
        `Admin-level access granted for user ${user.id} (role: ${user.roleEntity.name}) to ticket ${ticketId} via support permissions`,
      );
      return true;
    }

    // If ticket is unassigned, only users with admin-level permissions can access
    if (!ticket.assignedTo) {
      this.logger.warn(
        `User ${user.id} (role: ${user.roleEntity.name}) attempted to access unassigned ticket ${ticketId}. Only users with admin-level support permissions can access unassigned tickets.`,
      );
      throw new ForbiddenException(
        'Insufficient permissions: Only admins can access unassigned tickets',
      );
    }

    // For users with only read permission, they can only access tickets assigned to them
    // Find the SupportAgent that corresponds to this AdminUser by adminUserId
    const supportAgent = await this.agentRepository.findByAdminUserId(user.id);
    if (!supportAgent) {
      this.logger.warn(
        `User ${user.id} (email: ${user.email}) attempted to access ticket ${ticketId} but no corresponding SupportAgent found. Users with read-only support permissions must be agents to access assigned tickets.`,
      );
      throw new ForbiddenException(
        'Insufficient permissions: Agent profile not found or ticket not assigned to you',
      );
    }

    // Check if the ticket is assigned to this agent
    if (supportAgent.id !== ticket.assignedTo) {
      this.logger.warn(
        `User ${user.id} (agent id: ${supportAgent.id}) attempted to access ticket ${ticketId} assigned to agent ${ticket.assignedTo}`,
      );
      throw new ForbiddenException(
        'Insufficient permissions: You can only access tickets assigned to you',
      );
    }

    this.logger.debug(
      `Agent access granted for user ${user.id} (agent id: ${supportAgent.id}) to ticket ${ticketId} via support read permission`,
    );
    return true;
  }
}
