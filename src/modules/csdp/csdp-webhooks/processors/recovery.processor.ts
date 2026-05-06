import { Logger } from '@nestjs/common';
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { toE164Nigerian, maskMsisdn } from '../../../../common/utils/phone.utils';
import { SubscriberBalanceService } from '../../../csdp/csdp-subscribers/subscriber-balance.service';
import { FeatureRowLiveWriterService } from '../../csdp-linking/feature-row-live-writer.service';

export interface RecoveryJobPayload {
  recovery_id: string;
  msisdn: string;
  amount_naira: string;
  recovered_at: string;
  loan_items: { loan_id: string; amount_applied_naira: string }[];
  inbound_log_id: string;
}

@Processor('csdp-recovery-notifications', { concurrency: 5 })
export class RecoveryProcessor extends WorkerHost {
  private readonly logger = new Logger(RecoveryProcessor.name);

  constructor(
    @InjectDataSource('csdpBatch')
    private readonly dataSource: DataSource,
    private readonly subscriberBalance: SubscriberBalanceService,
    private readonly featureRow: FeatureRowLiveWriterService,
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
        `INSERT INTO csdp_recovery (recovery_id, msisdn, amount_naira, recovered_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (recovery_id) DO NOTHING`,
        [data.recovery_id, msisdn, data.amount_naira, data.recovered_at],
      );

      // Track how many loans were newly recovered in this pass
      let newlyRecoveredCount = 0;

      for (const item of loanItems) {
        await manager.query(
          `INSERT INTO csdp_recovery_loan_item (recovery_id, loan_id, amount_applied_naira)
           VALUES ($1, $2, $3)
           ON CONFLICT (recovery_id, loan_id) DO NOTHING`,
          [data.recovery_id, item.loan_id, item.amount_applied_naira],
        );

        // Capture prior status + repayable so the live feature-row writer
        // can attribute the delta correctly (cured-default vs ordinary
        // repayment). FOR UPDATE serializes concurrent recovery deliveries.
        const priorRows: Array<{ status: string; repayable_naira: string }> =
          await manager.query(
            `SELECT status, repayable_naira FROM csdp_loan
             WHERE loan_id = $1
             FOR UPDATE`,
            [item.loan_id],
          );

        if (priorRows.length === 0) continue;
        const priorStatus = priorRows[0].status;
        const repayable = priorRows[0].repayable_naira;

        if (priorStatus === 'RECOVERED') continue;

        await manager.query(
          `UPDATE csdp_loan
           SET status       = 'RECOVERED',
               recovered_at = $2,
               updated_at   = now()
           WHERE loan_id = $1`,
          [item.loan_id, data.recovered_at],
        );

        newlyRecoveredCount += 1;

        // §5.4 live writer: decrement our_outstanding_kobo, bump
        // loans_recovered_180d, and credit historical_cured_defaults_*
        // when the recovery cured a DEFAULTED loan.
        await this.featureRow.onLoanRecovered(
          msisdn,
          repayable,
          priorStatus === 'DEFAULTED',
          manager,
        );
      }

      // Recompute outstanding_naira from all ISSUED loans (recompute strategy).
      // repayable_naira is already numeric(12,2); SUM yields numeric naira string.
      const sumResult: Array<{ total: string | null }> = await manager.query(
        `SELECT COALESCE(SUM(repayable_naira), 0)::text AS total
         FROM csdp_loan
         WHERE msisdn = $1 AND status = 'ISSUED'`,
        [msisdn],
      );
      const recomputedNaira = sumResult[0]?.total ?? '0';

      await manager.query(
        `INSERT INTO csdp_subscriber (msisdn, outstanding_naira, loans_taken, loans_recovered, blacklisted)
         VALUES ($1, $2, 0, $3, false)
         ON CONFLICT (msisdn) DO UPDATE
           SET outstanding_naira = EXCLUDED.outstanding_naira,
               loans_recovered  = csdp_subscriber.loans_recovered + $3,
               updated_at       = now()`,
        [msisdn, recomputedNaira, newlyRecoveredCount],
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
