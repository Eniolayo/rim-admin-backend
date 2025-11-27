import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { NotificationType } from '../../../entities/notification.entity';
import { RelatedEntityType } from '../../../entities/notification.entity';

export interface NotificationData {
  type: NotificationType;
  title: string;
  message: string;
  recipientId: string;
  relatedEntityType?: RelatedEntityType | null;
  relatedEntityId?: string | null;
  metadata?: Record<string, unknown> | null;
}

@Injectable()
export class NotificationQueueService {
  private readonly logger = new Logger(NotificationQueueService.name);

  constructor(
    @InjectQueue('notifications')
    private readonly notificationQueue: Queue,
  ) {}

  /**
   * Enqueue a single notification (non-blocking, fire-and-forget)
   */
  async enqueue(data: NotificationData): Promise<void> {
    try {
      await this.notificationQueue.add('process-notification', data, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: {
          count: 10, // Keep only last 10 completed jobs for debugging
        },
        removeOnFail: {
          age: 86400, // Keep failed jobs for 24 hours for troubleshooting
        },
      });
    } catch (error) {
      // Don't break request flow if queue fails
      this.logger.error(
        `Failed to enqueue notification: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Enqueue multiple notifications (non-blocking, fire-and-forget)
   */
  async enqueueBulk(data: NotificationData[]): Promise<void> {
    try {
      const jobs = data.map((notification) => ({
        name: 'process-notification',
        data: notification,
        opts: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          removeOnComplete: {
            count: 10,
          },
          removeOnFail: {
            age: 86400,
          },
        },
      }));

      await this.notificationQueue.addBulk(jobs);
    } catch (error) {
      // Don't break request flow if queue fails
      this.logger.error(
        `Failed to enqueue bulk notifications: ${error.message}`,
        error.stack,
      );
    }
  }
}

