import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  LINKING_JOB_MATERIALIZE,
  LINKING_JOB_SWEEP,
} from './processors/eligibility-linking.processor';

/** 03:00 every day, Africa/Lagos (CSDP_MIGRATION_PHASES §"Phase 2"). The
 *  daily materialize job absorbs the legacy 5-min log-linking sweep — see
 *  step 11. */
const MATERIALIZE_CRON = '0 3 * * *';
const MATERIALIZE_TZ = 'Africa/Lagos';
const MATERIALIZE_JOB_ID = 'csdp-feature-row-materialize-daily';

/** Pre-step-11 cadence. Kept as a constant solely so we can ask Bull to
 *  remove the legacy repeatable on boot; the scheduler no longer
 *  registers it. */
const LEGACY_SWEEP_EVERY_MS = 5 * 60 * 1000;

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

    await this.purgeLegacySweep();
    await this.registerMaterialize();
  }

  /** Boot-time hygiene: any leftover 5-min sweep repeatable from the
   *  pre-step-11 scheduler gets removed so we don't run the cheap-query
   *  twice (once on the legacy cadence, once inside the daily run). */
  private async purgeLegacySweep(): Promise<void> {
    try {
      await this.queue.removeRepeatable(LINKING_JOB_SWEEP, {
        every: LEGACY_SWEEP_EVERY_MS,
      });
    } catch (err) {
      this.logger.warn(
        `Could not purge legacy sweep repeatable (likely absent): ${(err as Error).message}`,
      );
    }
  }

  private async registerMaterialize(): Promise<void> {
    try {
      await this.queue.removeRepeatable(LINKING_JOB_MATERIALIZE, {
        pattern: MATERIALIZE_CRON,
        tz: MATERIALIZE_TZ,
      });
    } catch (err) {
      this.logger.warn(
        `Could not remove existing materialize repeatable (may not exist): ${(err as Error).message}`,
      );
    }

    await this.queue.add(
      LINKING_JOB_MATERIALIZE,
      {},
      {
        jobId: MATERIALIZE_JOB_ID,
        repeat: { pattern: MATERIALIZE_CRON, tz: MATERIALIZE_TZ },
        removeOnComplete: 100,
        removeOnFail: false,
      },
    );

    this.logger.log(
      `Registered daily feature-row materialize job (${MATERIALIZE_CRON} ${MATERIALIZE_TZ}); log-linking sweep is folded in`,
    );
  }
}
