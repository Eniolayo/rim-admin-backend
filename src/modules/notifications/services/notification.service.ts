import { Injectable, Logger } from '@nestjs/common';
import { NotificationRepository } from '../repositories/notification.repository';
import { NotificationQueueService } from './notification-queue.service';
import { NotificationConfigService } from './notification-config.service';
import {
  NotificationType,
  RelatedEntityType,
} from '../../../entities/notification.entity';
import { SupportTicket } from '../../../entities/support-ticket.entity';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly notificationRepository: NotificationRepository,
    private readonly notificationQueueService: NotificationQueueService,
    private readonly notificationConfigService: NotificationConfigService,
  ) {}

  /**
   * Notify all admins and superAdmins when a ticket is created
   */
  async notifyTicketCreated(ticket: SupportTicket): Promise<void> {
    try {
      const recipients = await this.notificationConfigService.getRecipientsForTicketCreated();

      if (recipients.length === 0) {
        this.logger.warn('No recipients found for ticket created notification');
        return;
      }

      const notifications = recipients.map((admin) => ({
        type: NotificationType.TICKET_CREATED,
        title: 'New Support Ticket',
        message: `User ${ticket.customerName || ticket.customerPhone || 'Unknown'} opened a new support ticket #${ticket.ticketNumber}`,
        recipientId: admin.id,
        relatedEntityType: RelatedEntityType.TICKET,
        relatedEntityId: ticket.id,
        metadata: {
          ticketNumber: ticket.ticketNumber,
          customerName: ticket.customerName,
          customerPhone: ticket.customerPhone,
          customerEmail: ticket.customerEmail,
          subject: ticket.subject,
          category: ticket.category,
          priority: ticket.priority,
        },
      }));

      await this.notificationQueueService.enqueueBulk(notifications);
      this.logger.log(
        `Enqueued ${notifications.length} notifications for ticket created: ${ticket.ticketNumber}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to notify ticket created: ${error.message}`,
        error.stack,
      );
      // Don't throw - notification failure shouldn't break ticket creation
    }
  }

  /**
   * Notify assigned agent when a ticket is assigned
   */
  async notifyTicketAssigned(
    ticket: SupportTicket,
    agentId: string,
  ): Promise<void> {
    try {
      const recipients = await this.notificationConfigService.getRecipientsForTicketAssigned(
        agentId,
      );

      if (recipients.length === 0) {
        this.logger.warn(
          `No recipients found for ticket assigned notification (agentId: ${agentId})`,
        );
        return;
      }

      const notifications = recipients.map((admin) => ({
        type: NotificationType.TICKET_ASSIGNED,
        title: 'Ticket Assigned',
        message: `Ticket #${ticket.ticketNumber} has been assigned to you`,
        recipientId: admin.id,
        relatedEntityType: RelatedEntityType.TICKET,
        relatedEntityId: ticket.id,
        metadata: {
          ticketNumber: ticket.ticketNumber,
          customerName: ticket.customerName,
          customerPhone: ticket.customerPhone,
          customerEmail: ticket.customerEmail,
          subject: ticket.subject,
          category: ticket.category,
          priority: ticket.priority,
          assignedToName: ticket.assignedToName,
        },
      }));

      await this.notificationQueueService.enqueueBulk(notifications);
      this.logger.log(
        `Enqueued ${notifications.length} notifications for ticket assigned: ${ticket.ticketNumber} to ${agentId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to notify ticket assigned: ${error.message}`,
        error.stack,
      );
      // Don't throw - notification failure shouldn't break ticket assignment
    }
  }

  /**
   * Notify escalated admin/agent when a ticket is escalated
   */
  async notifyTicketEscalated(
    ticket: SupportTicket,
    escalatedToId: string,
  ): Promise<void> {
    try {
      const recipients = await this.notificationConfigService.getRecipientsForTicketEscalated(
        escalatedToId,
      );

      if (recipients.length === 0) {
        this.logger.warn(
          `No recipients found for ticket escalated notification (escalatedToId: ${escalatedToId})`,
        );
        return;
      }

      const notifications = recipients.map((admin) => ({
        type: NotificationType.TICKET_ESCALATED,
        title: 'Ticket Escalated',
        message: `Ticket #${ticket.ticketNumber} has been escalated to you`,
        recipientId: admin.id,
        relatedEntityType: RelatedEntityType.TICKET,
        relatedEntityId: ticket.id,
        metadata: {
          ticketNumber: ticket.ticketNumber,
          customerName: ticket.customerName,
          customerPhone: ticket.customerPhone,
          customerEmail: ticket.customerEmail,
          subject: ticket.subject,
          category: ticket.category,
          priority: ticket.priority,
          escalatedToName: ticket.escalatedToName,
          previousAgentName: ticket.assignedToName,
        },
      }));

      await this.notificationQueueService.enqueueBulk(notifications);
      this.logger.log(
        `Enqueued ${notifications.length} notifications for ticket escalated: ${ticket.ticketNumber} to ${escalatedToId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to notify ticket escalated: ${error.message}`,
        error.stack,
      );
      // Don't throw - notification failure shouldn't break ticket escalation
    }
  }

  /**
   * Generic method to create a notification
   * Can be used for future notification types
   */
  async createNotification(data: {
    type: NotificationType;
    title: string;
    message: string;
    recipientId: string;
    relatedEntityType?: RelatedEntityType | null;
    relatedEntityId?: string | null;
    metadata?: Record<string, unknown> | null;
  }): Promise<void> {
    try {
      await this.notificationQueueService.enqueue({
        type: data.type,
        title: data.title,
        message: data.message,
        recipientId: data.recipientId,
        relatedEntityType: data.relatedEntityType,
        relatedEntityId: data.relatedEntityId,
        metadata: data.metadata,
      });
    } catch (error) {
      this.logger.error(
        `Failed to create notification: ${error.message}`,
        error.stack,
      );
      // Don't throw - notification failure shouldn't break business logic
    }
  }
}

