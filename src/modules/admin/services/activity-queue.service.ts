import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { AdminUser } from '../../../entities/admin-user.entity';

export interface ActivityLogData {
  adminId: string;
  adminName: string;
  action: string;
  resource: string;
  resourceId?: string | null;
  details?: Record<string, unknown> | null;
  ipAddress?: string | null;
}

@Injectable()
export class ActivityQueueService {
  private readonly logger = new Logger(ActivityQueueService.name);

  constructor(
    @InjectQueue('activity-logs')
    private readonly activityQueue: Queue,
  ) {}

  /**
   * Enqueue an activity log entry (non-blocking, fire-and-forget)
   */
  async enqueue(data: ActivityLogData): Promise<void> {
    try {
      await this.activityQueue.add('batch-process', data, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: {
          count: 10, // Keep only last 10 completed jobs for debugging (logs are in DB)
        },
        removeOnFail: {
          age: 86400, // Keep failed jobs for 24 hours for troubleshooting
        },
      });
    } catch (error) {
      // Don't break request flow if queue fails
      this.logger.error(
        `Failed to enqueue activity log: ${error.message}`,
        error.stack,
      );
    }
  }
}
