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

    // Check if user is Admin or SuperAdmin (they can access all tickets)
    if (!user.roleEntity) {
      this.logger.warn(`User ${user.id} has no role entity loaded`);
      throw new ForbiddenException('User role not found');
    }

    const roleName = user.roleEntity.name.toLowerCase().trim();
    const isSuperAdmin = roleName === 'super_admin';
    const isAdmin = roleName === 'admin';

    if (isSuperAdmin || isAdmin) {
      this.logger.debug(
        `Admin/SuperAdmin access granted for user ${user.id} (role: ${user.roleEntity.name}) to ticket ${ticketId}`,
      );
      return true;
    }

    // If ticket is unassigned, only Admin/SuperAdmin can access
    if (!ticket.assignedTo) {
      this.logger.warn(
        `User ${user.id} (role: ${user.roleEntity.name}) attempted to access unassigned ticket ${ticketId}. Only admins can access unassigned tickets.`,
      );
      throw new ForbiddenException(
        'Insufficient permissions: Only admins can access unassigned tickets',
      );
    }

    // Check if user is an agent (moderator or support agent)
    const isModerator = roleName === 'moderator';
    const isSupportAgent = roleName === 'support agent';

    if (!isModerator && !isSupportAgent) {
      this.logger.warn(
        `User ${user.id} (role: ${user.roleEntity.name}) attempted to access ticket ${ticketId} but is not an agent or admin`,
      );
      throw new ForbiddenException(
        'Insufficient permissions: Only agents and admins can access assigned tickets',
      );
    }

    // Find the SupportAgent that corresponds to this AdminUser by adminUserId
    const supportAgent = await this.agentRepository.findByAdminUserId(user.id);
    if (!supportAgent) {
      this.logger.warn(
        `User ${user.id} (email: ${user.email}) is an agent but no corresponding SupportAgent found`,
      );
      throw new ForbiddenException(
        'Insufficient permissions: Agent profile not found',
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
      `Agent access granted for user ${user.id} (agent id: ${supportAgent.id}) to ticket ${ticketId}`,
    );
    return true;
  }
}

