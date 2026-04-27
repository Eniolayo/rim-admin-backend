import { Logger } from '@nestjs/common';
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { toE164Nigerian, maskMsisdn } from '../../../../common/utils/phone.utils';
import { SubscriberBalanceService } from '../../../csdp/csdp-subscribers/subscriber-balance.service';

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

    await this.dataSource.transaction(async (manager) => {
      // Upsert the loan row, capturing the prior status
      const existing: Array<{ status: string }> = await manager.query(
        `SELECT status FROM csdp_loan WHERE loan_id = $1 FOR UPDATE`,
        [data.loan_id],
      );
      const priorStatus = existing.length > 0 ? existing[0].status : null;

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

      // Recompute outstanding_kobo from all ISSUED loans for this subscriber.
      // This is the "recompute" strategy: safe against double-processing and
      // concurrent mutations without complex delta tracking.
      const sumResult: Array<{ total: string | null }> = await manager.query(
        `SELECT COALESCE(SUM(CAST(repayable_naira * 100 AS BIGINT)), 0)::text AS total
         FROM csdp_loan
         WHERE msisdn = $1 AND status = 'ISSUED'`,
        [msisdn],
      );
      const recomputedKobo = BigInt(sumResult[0]?.total ?? '0');

      // Update loans_taken counter only if this is a newly inserted ISSUED loan
      if (data.status === 'ISSUED' && priorStatus === null) {
        await manager.query(
          `INSERT INTO csdp_subscriber (msisdn, outstanding_kobo, loans_taken, loans_recovered, blacklisted)
           VALUES ($1, $2, 1, 0, false)
           ON CONFLICT (msisdn) DO UPDATE
             SET outstanding_kobo = EXCLUDED.outstanding_kobo,
                 loans_taken      = csdp_subscriber.loans_taken + 1,
                 last_loan_at     = $3,
                 updated_at       = now()`,
          [msisdn, recomputedKobo.toString(), data.issued_at],
        );
      } else {
        // Just sync outstanding balance (status change or re-delivery)
        await manager.query(
          `INSERT INTO csdp_subscriber (msisdn, outstanding_kobo, loans_taken, loans_recovered, blacklisted)
           VALUES ($1, $2, 0, 0, false)
           ON CONFLICT (msisdn) DO UPDATE
             SET outstanding_kobo = EXCLUDED.outstanding_kobo,
                 updated_at       = now()`,
          [msisdn, recomputedKobo.toString()],
        );
      }
    });
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<LoanJobPayload>, error: Error): void {
    this.logger.error(
      `Loan job ${job.id} (${job.name}) failed after ${job.attemptsMade} attempt(s) — msisdn: ${maskMsisdn(job.data?.msisdn)} — ${error.message}`,
      error.stack,
    );
  }
}
