import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { EXPOSURE_JOB_PUBLISH } from './exposure-publisher.processor';

/** 30 s tight cadence — Stage 4 clamp 3 reads `system_exposure_pct`. The
 *  Redis TTL on the value is 120 s, so two consecutive publish failures
 *  are needed before the value decays to 0 (no taper). */
const PUBLISH_EVERY_MS = 30 * 1000;
const PUBLISH_JOB_ID = 'csdp-exposure-publish';

@Injectable()
export class ExposurePublisherScheduler implements OnModuleInit {
  private readonly logger = new Logger(ExposurePublisherScheduler.name);

  constructor(
    @InjectQueue('csdp-exposure')
    private readonly queue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    if (process.env.RUN_SCHEDULERS !== '1') {
      this.logger.log('RUN_SCHEDULERS not set — skipping exposure publisher registration');
      return;
    }

    try {
      await this.queue.removeRepeatable(EXPOSURE_JOB_PUBLISH, {
        every: PUBLISH_EVERY_MS,
      });
    } catch (err) {
      this.logger.warn(
        `Could not remove existing exposure repeatable (may not exist): ${(err as Error).message}`,
      );
    }

    await this.queue.add(
      EXPOSURE_JOB_PUBLISH,
      {},
      {
        jobId: PUBLISH_JOB_ID,
        repeat: { every: PUBLISH_EVERY_MS },
        removeOnComplete: 100,
        removeOnFail: false,
      },
    );

    this.logger.log(
      `Registered exposure publisher every ${PUBLISH_EVERY_MS / 1000}s`,
    );
  }
}
