import { Logger, UseGuards } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { WsJwtGuard } from '../../auth/guards/ws-jwt.guard';
import { Notification } from '../../../entities/notification.entity';
import { NotificationRepository } from '../repositories/notification.repository';

@WebSocketGateway({ namespace: '/notifications', cors: { origin: true, credentials: true } })
export class NotificationGateway {
  private readonly logger = new Logger(NotificationGateway.name);

  constructor(
    private readonly notificationRepository: NotificationRepository,
  ) {}

  @WebSocketServer()
  server: Server;

  private adminRoom(adminId: string): string {
    return `admin:${adminId}`;
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('notification:subscribe')
  async handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: any,
  ) {
    const user = (client.data && (client.data as any).user) || null;
    if (!user) {
      return { status: 'error', message: 'unauthenticated' };
    }

    const adminId = user.id;
    const room = this.adminRoom(adminId);
    await client.join(room);

    // Get unread count and send it to the client
    const unreadCount = await this.notificationRepository.getUnreadCount(
      adminId,
    );

    this.logger.log(`Client ${client.id} subscribed to notifications for admin ${adminId}`);
    
    // Send current unread count
    client.emit('notification:unread_count', { count: unreadCount });

    return { status: 'ok', unreadCount };
  }

  /**
   * Emit a notification to a specific admin
   */
  emitNotification(notification: Notification): void {
    if (!notification?.recipientId) {
      this.logger.warn('Cannot emit notification: missing recipientId');
      return;
    }

    const room = this.adminRoom(notification.recipientId);
    this.server.to(room).emit('notification:new', notification);
    this.logger.log(
      `Emitted notification ${notification.id} to room ${room}`,
    );

    // Also update unread count
    this.updateUnreadCount(notification.recipientId);
  }

  /**
   * Update unread count for a specific admin
   */
  private async updateUnreadCount(adminId: string): Promise<void> {
    try {
      const unreadCount = await this.notificationRepository.getUnreadCount(
        adminId,
      );
      const room = this.adminRoom(adminId);
      this.server.to(room).emit('notification:unread_count', { count: unreadCount });
    } catch (error) {
      this.logger.error(
        `Failed to update unread count for admin ${adminId}: ${error.message}`,
      );
    }
  }

  /**
   * Notify unread count update (called when notification is marked as read)
   */
  async notifyUnreadCountUpdate(adminId: string): Promise<void> {
    await this.updateUnreadCount(adminId);
  }
}

