import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger, OnModuleDestroy } from '@nestjs/common';
import { NotificationRepository } from '../repositories/notification.repository';
import { NotificationGateway } from '../gateways/notification.gateway';
import { NotificationData } from '../services/notification-queue.service';

@Processor('notifications', {
  concurrency: 5, // Process multiple notifications in parallel
})
export class NotificationProcessor
  extends WorkerHost
  implements OnModuleDestroy
{
  private readonly logger = new Logger(NotificationProcessor.name);
  private batchBuffer: NotificationData[] = [];
  private batchTimeout: NodeJS.Timeout | null = null;
  private readonly BATCH_SIZE = 20; // Batch size for efficient database writes
  private readonly BATCH_TIMEOUT_MS = 3000; // 3 seconds
  private readonly lock = { locked: false };

  constructor(
    private readonly notificationRepository: NotificationRepository,
    private readonly notificationGateway: NotificationGateway,
  ) {
    super();
  }

  async process(job: Job<NotificationData>): Promise<void> {
    const { data } = job;

    // Add to batch buffer
    this.batchBuffer.push(data);

    // If batch is full, process immediately
    if (this.batchBuffer.length >= this.BATCH_SIZE) {
      // Clear any existing timeout since we're flushing now
      if (this.batchTimeout) {
        clearTimeout(this.batchTimeout);
        this.batchTimeout = null;
      }
      await this.flushBatch();
      return;
    }

    // Otherwise, set/reset timeout to flush after delay
    if (!this.lock.locked) {
      // Clear existing timeout if any
      if (this.batchTimeout) {
        clearTimeout(this.batchTimeout);
      }

      // Set new timeout
      this.batchTimeout = setTimeout(() => {
        this.flushBatch().catch((error) => {
          this.logger.error(
            `Error flushing batch on timeout: ${error.message}`,
            error.stack,
          );
        });
      }, this.BATCH_TIMEOUT_MS);
    }
  }

  private async flushBatch(): Promise<void> {
    // Prevent concurrent flushes
    if (this.lock.locked) {
      return;
    }

    this.lock.locked = true;

    try {
      // Clear timeout
      if (this.batchTimeout) {
        clearTimeout(this.batchTimeout);
        this.batchTimeout = null;
      }

      // Get current batch
      const batch = [...this.batchBuffer];
      const batchLength = batch.length;

      if (batchLength === 0) {
        return;
      }

      // Clear buffer before processing (so new items go to new batch)
      this.batchBuffer = [];

      // Batch insert to database
      const savedNotifications = await this.notificationRepository.bulkCreate(
        batch,
      );

      this.logger.debug(
        `Successfully processed batch of ${batchLength} notifications`,
      );

      // Emit notifications via WebSocket after database persistence
      for (const notification of savedNotifications) {
        this.notificationGateway.emitNotification(notification);
      }
    } catch (error) {
      this.logger.error(
        `Failed to process batch: ${error.message}`,
        error.stack,
      );
      // Re-throw to trigger BullMQ retry
      throw error;
    } finally {
      this.lock.locked = false;
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.debug(`Notification job ${job.id} completed`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(
      `Notification job ${job.id} failed: ${error.message}`,
      error.stack,
    );
  }

  /**
   * Flush any remaining batch on shutdown
   */
  async onModuleDestroy(): Promise<void> {
    if (this.batchBuffer.length > 0) {
      await this.flushBatch();
    }
  }
}

