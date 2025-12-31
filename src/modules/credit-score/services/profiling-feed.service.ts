import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Logger } from 'nestjs-pino';

/**
 * Service to manage the periodic processing of profiling feeds from Airtel.
 * Schedules a background job to run every 5 minutes.
 */
@Injectable()
export class ProfilingFeedService implements OnModuleInit {
  constructor(
    @InjectQueue('profiling-feed') private readonly profilingQueue: Queue,
    private readonly logger: Logger,
  ) {}

  async onModuleInit() {
    this.logger.log('Initializing Airtel profiling feed scheduler...');
    await this.setupRepeatableJob();
  }

  /**
   * Configures a repeatable job to process the profiling feed every 5 minutes.
   */
  private async setupRepeatableJob() {
    try {
      // Remove existing repeatable jobs for this name to prevent duplicates if config changes
      const repeatableJobs = await this.profilingQueue.getRepeatableJobs();
      for (const job of repeatableJobs) {
        if (job.name === 'process-feed') {
          await this.profilingQueue.removeRepeatableByKey(job.key);
        }
      }

      // Add the job with a 5-minute interval (300,000 ms)
      await this.profilingQueue.add(
        'process-feed',
        { timestamp: new Date().toISOString() },
        {
          repeat: {
            every: 300000, // 5 minutes
          },
          removeOnComplete: true,
          removeOnFail: false,
        },
      );

      this.logger.log('Profiling feed job scheduled: runs every 5 minutes.');
    } catch (error) {
      this.logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        'Failed to schedule profiling feed job',
      );
    }
  }

  /**
   * Manually trigger the profiling feed process (useful for admin/testing).
   */
  async triggerManualProcessing() {
    await this.profilingQueue.add('process-feed', {
      timestamp: new Date().toISOString(),
      manual: true,
    });
    this.logger.log('Manual profiling feed processing triggered.');
  }
}
