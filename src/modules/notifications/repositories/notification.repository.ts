import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Notification,
  NotificationStatus,
  NotificationType,
  RelatedEntityType,
} from '../../../entities/notification.entity';

@Injectable()
export class NotificationRepository {
  private readonly logger = new Logger(NotificationRepository.name);

  constructor(
    @InjectRepository(Notification)
    private readonly repository: Repository<Notification>,
  ) {}

  async create(data: {
    type: NotificationType;
    title: string;
    message: string;
    recipientId: string;
    relatedEntityType?: RelatedEntityType | null;
    relatedEntityId?: string | null;
    metadata?: Record<string, unknown> | null;
  }): Promise<Notification> {
    const notification = this.repository.create({
      type: data.type,
      title: data.title,
      message: data.message,
      recipientId: data.recipientId,
      relatedEntityType: data.relatedEntityType ?? null,
      relatedEntityId: data.relatedEntityId ?? null,
      metadata: data.metadata ?? null,
      status: NotificationStatus.UNREAD,
    });
    return this.repository.save(notification);
  }

  async bulkCreate(
    data: Array<{
      type: NotificationType;
      title: string;
      message: string;
      recipientId: string;
      relatedEntityType?: RelatedEntityType | null;
      relatedEntityId?: string | null;
      metadata?: Record<string, unknown> | null;
    }>,
  ): Promise<Notification[]> {
    const notifications = data.map((item) =>
      this.repository.create({
        type: item.type,
        title: item.title,
        message: item.message,
      recipientId: item.recipientId,
      relatedEntityType: item.relatedEntityType ?? null,
        relatedEntityId: item.relatedEntityId ?? null,
        metadata: item.metadata ?? null,
        status: NotificationStatus.UNREAD,
      }),
    );
    return this.repository.save(notifications);
  }

  async findByRecipient(
    recipientId: string,
    filters?: {
      status?: NotificationStatus;
      type?: NotificationType;
      limit?: number;
      offset?: number;
    },
  ): Promise<Notification[]> {
    const qb = this.repository
      .createQueryBuilder('notification')
      .where('notification.recipientId = :recipientId', { recipientId });

    if (filters?.status) {
      qb.andWhere('notification.status = :status', { status: filters.status });
    }

    if (filters?.type) {
      qb.andWhere('notification.type = :type', { type: filters.type });
    }

    if (filters?.limit) {
      qb.limit(filters.limit);
    }

    if (filters?.offset) {
      qb.offset(filters.offset);
    }

    return qb.orderBy('notification.createdAt', 'DESC').getMany();
  }

  async getUnreadCount(recipientId: string): Promise<number> {
    return this.repository.count({
      where: {
        recipientId,
        status: NotificationStatus.UNREAD,
      },
    });
  }

  async markAsRead(id: string, recipientId: string): Promise<void> {
    await this.repository.update(
      { id, recipientId },
      {
        status: NotificationStatus.READ,
        readAt: new Date(),
      },
    );
  }

  async markAllAsRead(recipientId: string): Promise<void> {
    await this.repository.update(
      { recipientId, status: NotificationStatus.UNREAD },
      {
        status: NotificationStatus.READ,
        readAt: new Date(),
      },
    );
  }

  async findByRelatedEntity(
    relatedEntityType: RelatedEntityType,
    relatedEntityId: string,
  ): Promise<Notification[]> {
    return this.repository.find({
      where: {
        relatedEntityType,
        relatedEntityId,
      },
      order: {
        createdAt: 'DESC',
      },
    });
  }

  async findById(id: string): Promise<Notification | null> {
    return this.repository.findOne({
      where: { id },
      relations: ['recipient'],
    });
  }
}

