import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { RETENTION_JOB_RUN } from './retention.processor';

/** Daily at 02:30 Africa/Lagos — runs before the 03:00 EligibilityLinkingProcessor. */
const RETENTION_CRON = '30 2 * * *';
const RETENTION_TZ = 'Africa/Lagos';
const RETENTION_JOB_ID = 'csdp-retention-daily';

@Injectable()
export class RetentionScheduler implements OnModuleInit {
  private readonly logger = new Logger(RetentionScheduler.name);

  constructor(
    @InjectQueue('csdp-retention')
    private readonly queue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    if (process.env.RUN_SCHEDULERS !== '1') {
      this.logger.log(
        'RUN_SCHEDULERS not set — skipping retention scheduler registration',
      );
      return;
    }

    try {
      await this.queue.removeRepeatable(RETENTION_JOB_RUN, {
        pattern: RETENTION_CRON,
        tz: RETENTION_TZ,
      });
    } catch (err) {
      this.logger.warn(
        `Could not remove existing retention repeatable (may not exist): ${(err as Error).message}`,
      );
    }

    await this.queue.add(
      RETENTION_JOB_RUN,
      {},
      {
        jobId: RETENTION_JOB_ID,
        repeat: { pattern: RETENTION_CRON, tz: RETENTION_TZ },
        removeOnComplete: 30,
        removeOnFail: false,
      },
    );

    this.logger.log(
      `Registered daily retention job (${RETENTION_CRON} ${RETENTION_TZ})`,
    );
  }
}
