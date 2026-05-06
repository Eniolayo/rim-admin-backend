import { Logger } from '@nestjs/common';
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { toE164Nigerian, maskMsisdn } from '../../../../common/utils/phone.utils';
import { SubscriberBalanceService } from '../../../csdp/csdp-subscribers/subscriber-balance.service';
import { FeatureRowLiveWriterService } from '../../csdp-linking/feature-row-live-writer.service';
import { CsdpLiveCountersService } from '../../csdp-linking/csdp-live-counters.service';
import { LoanSnapshotService } from '../../csdp-linking/loan-snapshot.service';

export interface LoanJobPayload {
  loan_id: string;
  msisdn: string;
  vendor: string;
  loan_type: string;
  principal_naira: string;
  repayable_naira: string;
  status: string;
  trans_ref?: string;
  issued_at: string;
  recovered_at?: string;
  inbound_log_id: string;
}

@Processor('csdp-loan-notifications', { concurrency: 5 })
export class LoanProcessor extends WorkerHost {
  private readonly logger = new Logger(LoanProcessor.name);

  constructor(
    @InjectDataSource('csdpBatch')
    private readonly dataSource: DataSource,
    private readonly subscriberBalance: SubscriberBalanceService,
    private readonly featureRow: FeatureRowLiveWriterService,
    private readonly counters: CsdpLiveCountersService,
    private readonly loanSnapshot: LoanSnapshotService,
  ) {
    super();
  }

  async process(job: Job<LoanJobPayload>): Promise<void> {
    const data = job.data;

    // Validate required fields
    if (!data.loan_id || !data.msisdn || !data.status) {
      throw new Error(
        `Invalid loan job payload: missing loan_id, msisdn, or status (job ${job.id})`,
      );
    }

    const msisdn = toE164Nigerian(data.msisdn);
    if (!msisdn) {
      throw new Error(
        `Invalid MSISDN in loan job ${job.id}: ${maskMsisdn(data.msisdn)}`,
      );
    }

    let isFirstDelivery = false;

    await this.dataSource.transaction(async (manager) => {
      // Upsert the loan row, capturing the prior status
      const existing: Array<{ status: string }> = await manager.query(
        `SELECT status FROM csdp_loan WHERE loan_id = $1 FOR UPDATE`,
        [data.loan_id],
      );
      const priorStatus = existing.length > 0 ? existing[0].status : null;
      isFirstDelivery = priorStatus === null;

      // Upsert loan
      await manager.query(
        `INSERT INTO csdp_loan
           (loan_id, msisdn, vendor, loan_type, principal_naira, repayable_naira, status, trans_ref, issued_at, recovered_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (loan_id) DO UPDATE
           SET status       = EXCLUDED.status,
               recovered_at = EXCLUDED.recovered_at,
               updated_at   = now()`,
        [
          data.loan_id,
          msisdn,
          data.vendor ?? 'OTHER',
          data.loan_type,
          data.principal_naira,
          data.repayable_naira,
          data.status,
          data.trans_ref ?? null,
          data.issued_at,
          data.recovered_at ?? null,
        ],
      );

      // Recompute outstanding_naira from all ISSUED loans for this subscriber.
      // Recompute strategy: safe against double-processing and concurrent
      // mutations without explicit delta tracking. repayable_naira is already
      // numeric(12,2); SUM yields a numeric naira string directly.
      const sumResult: Array<{ total: string | null }> = await manager.query(
        `SELECT COALESCE(SUM(repayable_naira), 0)::text AS total
         FROM csdp_loan
         WHERE msisdn = $1 AND status = 'ISSUED'`,
        [msisdn],
      );
      const recomputedNaira = sumResult[0]?.total ?? '0';

      // Update loans_taken counter only if this is a newly inserted ISSUED loan
      if (data.status === 'ISSUED' && priorStatus === null) {
        await manager.query(
          `INSERT INTO csdp_subscriber (msisdn, outstanding_naira, loans_taken, loans_recovered, blacklisted)
           VALUES ($1, $2, 1, 0, false)
           ON CONFLICT (msisdn) DO UPDATE
             SET outstanding_naira = EXCLUDED.outstanding_naira,
                 loans_taken      = csdp_subscriber.loans_taken + 1,
                 last_loan_at     = $3,
                 updated_at       = now()`,
          [msisdn, recomputedNaira, data.issued_at],
        );

        // §5.4 live writer: bump loans_taken_180d + add to our_outstanding_kobo.
        // Only on first delivery — replay (priorStatus !== null) is a no-op.
        await this.featureRow.onLoanIssued(
          msisdn,
          data.repayable_naira,
          manager,
        );

        // Redis disbursed-24h counter (§7 Stage 4 clamp 2). Member uniqueness
        // by loan_id makes ZADD on the same id idempotent. Failures here
        // must not roll back the DB write — daily materializer reconciles
        // the PG mirror column nightly.
        try {
          await this.counters.recordDisbursement(
            msisdn,
            data.loan_id,
            data.repayable_naira,
            new Date(data.issued_at).getTime(),
          );
        } catch (err) {
          this.logger.warn(
            `recordDisbursement failed for loan ${data.loan_id}: ${(err as Error).message}`,
          );
        }
      } else {
        // Just sync outstanding balance (status change or re-delivery)
        await manager.query(
          `INSERT INTO csdp_subscriber (msisdn, outstanding_naira, loans_taken, loans_recovered, blacklisted)
           VALUES ($1, $2, 0, 0, false)
           ON CONFLICT (msisdn) DO UPDATE
             SET outstanding_naira = EXCLUDED.outstanding_naira,
                 updated_at       = now()`,
          [msisdn, recomputedNaira],
        );
      }
    });

    // §10 two-point snapshot — written outside the loan transaction so a
    // snapshot failure can never roll back the loan write. ON CONFLICT
    // (loan_id) DO NOTHING makes replays idempotent. Only snapshot on
    // first delivery; subsequent status updates leave the original row.
    if (isFirstDelivery) {
      try {
        await this.loanSnapshot.snapshotLoan(
          data.loan_id,
          msisdn,
          data.trans_ref ?? null,
        );
      } catch (err) {
        this.logger.warn(
          `loan snapshot failed for loan ${data.loan_id}: ${(err as Error).message}`,
        );
      }
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<LoanJobPayload>, error: Error): void {
    this.logger.error(
      `Loan job ${job.id} (${job.name}) failed after ${job.attemptsMade} attempt(s) — msisdn: ${maskMsisdn(job.data?.msisdn)} — ${error.message}`,
      error.stack,
    );
  }
}
