import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminUser } from '../../../entities/admin-user.entity';
import { NotificationType } from '../../../entities/notification.entity';

@Injectable()
export class NotificationConfigService {
  private readonly logger = new Logger(NotificationConfigService.name);

  constructor(
    @InjectRepository(AdminUser)
    private readonly adminUserRepository: Repository<AdminUser>,
  ) {}

  /**
   * Get recipients for ticket created notifications
   * Returns all admins and superAdmins
   */
  async getRecipientsForTicketCreated(): Promise<AdminUser[]> {
    try {
      // Get all active admin users with their role entities
      // Use query builder to filter by role name
      const admins = await this.adminUserRepository
        .createQueryBuilder('admin')
        .leftJoinAndSelect('admin.roleEntity', 'role')
        .where('admin.status = :status', { status: 'active' })
        .andWhere(
          '(LOWER(role.name) IN (:...roles) OR LOWER(admin.role) IN (:...roles))',
          { roles: ['admin', 'superadmin', 'super_admin'] },
        )
        .getMany();

      return admins;
    } catch (error) {
      this.logger.error(
        `Error getting recipients for ticket created: ${error.message}`,
        error.stack,
      );
      return [];
    }
  }

  /**
   * Get recipients for ticket assigned notifications
   * Returns the assigned agent/admin
   */
  async getRecipientsForTicketAssigned(
    agentId: string,
  ): Promise<AdminUser[]> {
    try {
      const admin = await this.adminUserRepository.findOne({
        where: { id: agentId },
        relations: ['roleEntity'],
      });

      if (admin && admin.status === 'active') {
        return [admin];
      }

      return [];
    } catch (error) {
      this.logger.error(
        `Error getting recipients for ticket assigned: ${error.message}`,
        error.stack,
      );
      return [];
    }
  }

  /**
   * Get recipients for ticket escalated notifications
   * Returns the escalated-to admin/agent
   */
  async getRecipientsForTicketEscalated(
    escalatedToId: string,
  ): Promise<AdminUser[]> {
    try {
      const admin = await this.adminUserRepository.findOne({
        where: { id: escalatedToId },
        relations: ['roleEntity'],
      });

      if (admin && admin.status === 'active') {
        return [admin];
      }

      return [];
    } catch (error) {
      this.logger.error(
        `Error getting recipients for ticket escalated: ${error.message}`,
        error.stack,
      );
      return [];
    }
  }

  /**
   * Generic method to get recipients for a notification type
   * Can be extended for future notification types
   */
  async getRecipientsForType(
    type: NotificationType,
    context?: {
      agentId?: string;
      escalatedToId?: string;
    },
  ): Promise<AdminUser[]> {
    switch (type) {
      case NotificationType.TICKET_CREATED:
        return this.getRecipientsForTicketCreated();
      case NotificationType.TICKET_ASSIGNED:
        if (!context?.agentId) {
          this.logger.warn('agentId required for TICKET_ASSIGNED notification');
          return [];
        }
        return this.getRecipientsForTicketAssigned(context.agentId);
      case NotificationType.TICKET_ESCALATED:
        if (!context?.escalatedToId) {
          this.logger.warn(
            'escalatedToId required for TICKET_ESCALATED notification',
          );
          return [];
        }
        return this.getRecipientsForTicketEscalated(context.escalatedToId);
      default:
        this.logger.warn(`Unknown notification type: ${type}`);
        return [];
    }
  }
}

