import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { AGING_JOB_RUN } from './aging.processor';

/** Top of every hour, Africa/Lagos. Phase 2 spec §"Phase 2" step 2. */
const AGING_CRON = '0 * * * *';
const AGING_TZ = 'Africa/Lagos';
const AGING_JOB_ID = 'csdp-aging-hourly';

@Injectable()
export class AgingScheduler implements OnModuleInit {
  private readonly logger = new Logger(AgingScheduler.name);

  constructor(
    @InjectQueue('csdp-aging')
    private readonly queue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    if (process.env.RUN_SCHEDULERS !== '1') {
      this.logger.log('RUN_SCHEDULERS not set — skipping aging scheduler registration');
      return;
    }

    try {
      await this.queue.removeRepeatable(AGING_JOB_RUN, {
        pattern: AGING_CRON,
        tz: AGING_TZ,
      });
    } catch (err) {
      this.logger.warn(
        `Could not remove existing aging repeatable (may not exist): ${(err as Error).message}`,
      );
    }

    await this.queue.add(
      AGING_JOB_RUN,
      {},
      {
        jobId: AGING_JOB_ID,
        repeat: { pattern: AGING_CRON, tz: AGING_TZ },
        removeOnComplete: 100,
        removeOnFail: false,
      },
    );

    this.logger.log(`Registered hourly aging job (${AGING_CRON} ${AGING_TZ})`);
  }
}
