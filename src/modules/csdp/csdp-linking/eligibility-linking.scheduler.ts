import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

const SWEEP_EVERY_MS = 5 * 60 * 1000; // 5 minutes
const SWEEP_JOB_NAME = 'sweep';
const SWEEP_JOB_ID = 'csdp-eligibility-linking-sweep';

@Injectable()
export class EligibilityLinkingScheduler implements OnModuleInit {
  private readonly logger = new Logger(EligibilityLinkingScheduler.name);

  constructor(
    @InjectQueue('csdp-eligibility-linking')
    private readonly queue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    if (process.env.RUN_SCHEDULERS !== '1') {
      this.logger.log('RUN_SCHEDULERS not set — skipping eligibility-linking scheduler registration');
      return;
    }

    // Defensively remove any existing repeatable with the same key to prevent accumulation
    try {
      await this.queue.removeRepeatable(SWEEP_JOB_NAME, { every: SWEEP_EVERY_MS });
    } catch (err) {
      this.logger.warn(`Could not remove existing repeatable job (may not exist): ${(err as Error).message}`);
    }

    await this.queue.add(
      SWEEP_JOB_NAME,
      {},
      {
        jobId: SWEEP_JOB_ID,
        repeat: { every: SWEEP_EVERY_MS },
        removeOnComplete: 100,
        removeOnFail: false,
      },
    );

    this.logger.log(`Registered repeatable sweep job every ${SWEEP_EVERY_MS / 1000}s`);
  }
}
