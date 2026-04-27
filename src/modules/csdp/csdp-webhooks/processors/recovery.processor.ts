import { Logger } from '@nestjs/common';
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { toE164Nigerian, maskMsisdn } from '../../../../common/utils/phone.utils';
import { SubscriberBalanceService } from '../../../csdp/csdp-subscribers/subscriber-balance.service';

export interface RecoveryJobPayload {
  recovery_id: string;
  msisdn: string;
  amount_kobo: string;
  recovered_at: string;
  loan_items: { loan_id: string; amount_applied_kobo: string }[];
  inbound_log_id: string;
}

@Processor('csdp-recovery-notifications', { concurrency: 5 })
export class RecoveryProcessor extends WorkerHost {
  private readonly logger = new Logger(RecoveryProcessor.name);

  constructor(
    @InjectDataSource('csdpBatch')
    private readonly dataSource: DataSource,
    private readonly subscriberBalance: SubscriberBalanceService,
  ) {
    super();
  }

  async process(job: Job<RecoveryJobPayload>): Promise<void> {
    const data = job.data;

    if (!data.recovery_id || !data.msisdn) {
      throw new Error(
        `Invalid recovery job payload: missing recovery_id or msisdn (job ${job.id})`,
      );
    }

    const msisdn = toE164Nigerian(data.msisdn);
    if (!msisdn) {
      throw new Error(
        `Invalid MSISDN in recovery job ${job.id}: ${maskMsisdn(data.msisdn)}`,
      );
    }

    const loanItems = Array.isArray(data.loan_items) ? data.loan_items : [];

    await this.dataSource.transaction(async (manager) => {
      // Insert recovery row (idempotent)
      await manager.query(
        `INSERT INTO csdp_recovery (recovery_id, msisdn, amount_kobo, recovered_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (recovery_id) DO NOTHING`,
        [data.recovery_id, msisdn, data.amount_kobo, data.recovered_at],
      );

      // Track how many loans were newly recovered in this pass
      let newlyRecoveredCount = 0;

      for (const item of loanItems) {
        // Insert recovery loan item (idempotent)
        await manager.query(
          `INSERT INTO csdp_recovery_loan_item (recovery_id, loan_id, amount_applied_kobo)
           VALUES ($1, $2, $3)
           ON CONFLICT (recovery_id, loan_id) DO NOTHING`,
          [data.recovery_id, item.loan_id, item.amount_applied_kobo],
        );

        // Update the loan status to RECOVERED, capturing if it actually changed
        const updateResult: Array<{ loan_id: string }> = await manager.query(
          `UPDATE csdp_loan
           SET status       = 'RECOVERED',
               recovered_at = $2,
               updated_at   = now()
           WHERE loan_id = $1
             AND status != 'RECOVERED'
           RETURNING loan_id`,
          [item.loan_id, data.recovered_at],
        );

        if (updateResult.length > 0) {
          newlyRecoveredCount += 1;
        }
      }

      // Recompute outstanding_kobo from all ISSUED loans (recompute strategy)
      const sumResult: Array<{ total: string | null }> = await manager.query(
        `SELECT COALESCE(SUM(CAST(repayable_naira * 100 AS BIGINT)), 0)::text AS total
         FROM csdp_loan
         WHERE msisdn = $1 AND status = 'ISSUED'`,
        [msisdn],
      );
      const recomputedKobo = BigInt(sumResult[0]?.total ?? '0');

      // Update subscriber: outstanding balance + recovered counter
      await manager.query(
        `INSERT INTO csdp_subscriber (msisdn, outstanding_kobo, loans_taken, loans_recovered, blacklisted)
         VALUES ($1, $2, 0, $3, false)
         ON CONFLICT (msisdn) DO UPDATE
           SET outstanding_kobo = EXCLUDED.outstanding_kobo,
               loans_recovered  = csdp_subscriber.loans_recovered + $3,
               updated_at       = now()`,
        [msisdn, recomputedKobo.toString(), newlyRecoveredCount],
      );
    });
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<RecoveryJobPayload>, error: Error): void {
    this.logger.error(
      `Recovery job ${job.id} (${job.name}) failed after ${job.attemptsMade} attempt(s) — msisdn: ${maskMsisdn(job.data?.msisdn)} — ${error.message}`,
      error.stack,
    );
  }
}
