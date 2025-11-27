import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { AdminUser } from '../../../entities/admin-user.entity';
import { NotificationService } from '../services/notification.service';
import { NotificationRepository } from '../repositories/notification.repository';
import { NotificationGateway } from '../gateways/notification.gateway';
import { NotificationResponseDto } from '../dto/notification-response.dto';
import { NotificationQueryDto } from '../dto/notification-query.dto';

@ApiTags('notifications')
@ApiBearerAuth()
@Throttle({ default: { limit: 100, ttl: 60000 } })
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationController {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly notificationRepository: NotificationRepository,
    private readonly notificationGateway: NotificationGateway,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get notifications for current user' })
  @ApiResponse({ status: 200, type: [NotificationResponseDto] })
  async getNotifications(
    @CurrentUser() user: AdminUser,
    @Query() query: NotificationQueryDto,
  ): Promise<NotificationResponseDto[]> {
    const notifications = await this.notificationRepository.findByRecipient(
      user.id,
      {
        status: query.status,
        type: query.type,
        limit: query.limit,
        offset: query.offset,
      },
    );

    return notifications.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      message: n.message,
      recipientId: n.recipientId,
      status: n.status,
      readAt: n.readAt,
      relatedEntityType: n.relatedEntityType,
      relatedEntityId: n.relatedEntityId,
      metadata: n.metadata,
      createdAt: n.createdAt,
      updatedAt: n.updatedAt,
    }));
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notification count for current user' })
  @ApiResponse({ status: 200, schema: { type: 'object', properties: { count: { type: 'number' } } } })
  async getUnreadCount(@CurrentUser() user: AdminUser): Promise<{ count: number }> {
    const count = await this.notificationRepository.getUnreadCount(user.id);
    return { count };
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  @ApiResponse({ status: 200, schema: { type: 'object', properties: { status: { type: 'string' } } } })
  async markAsRead(
    @Param('id') id: string,
    @CurrentUser() user: AdminUser,
  ): Promise<{ status: string }> {
    const notification = await this.notificationRepository.findById(id);
    if (!notification) {
      throw new NotFoundException(`Notification with id ${id} not found`);
    }

    if (notification.recipientId !== user.id) {
      throw new NotFoundException(`Notification with id ${id} not found`);
    }

    await this.notificationRepository.markAsRead(id, user.id);
    
    // Update unread count via WebSocket
    await this.notificationGateway.notifyUnreadCountUpdate(user.id);

    return { status: 'ok' };
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read for current user' })
  @ApiResponse({ status: 200, schema: { type: 'object', properties: { status: { type: 'string' } } } })
  async markAllAsRead(@CurrentUser() user: AdminUser): Promise<{ status: string }> {
    await this.notificationRepository.markAllAsRead(user.id);
    
    // Update unread count via WebSocket
    await this.notificationGateway.notifyUnreadCountUpdate(user.id);

    return { status: 'ok' };
  }
}

