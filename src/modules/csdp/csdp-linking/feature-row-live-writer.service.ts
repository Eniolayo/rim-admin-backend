import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';

/**
 * Live deltas to `csdp_subscriber_feature_row` per CSDP_SCORING_ALGORITHM
 * §5.4. Webhook processors call these inside their transaction so the
 * feature row stays directionally fresh between daily materializer runs.
 *
 * The daily 03:00 WAT materializer ([feature-row-materializer.service.ts])
 * recomputes every column from authoritative source tables and wins on
 * conflict, repairing any drift that accumulates here. Live writes are
 * approximate (e.g. they don't decrement loans_taken_180d when the 180-day
 * window slides); the daily recompute corrects this.
 */
@Injectable()
export class FeatureRowLiveWriterService {
  constructor(
    @InjectDataSource('csdpBatch')
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Fulfillment delta: a fresh ISSUED loan was just persisted. Increments
   * `loans_taken_180d` and adds `repayableNaira` (converted to kobo) to
   * `our_outstanding_kobo`. Idempotent at the FeatureRow level — caller
   * must guard against double-application by skipping when the loan was
   * already known (priorStatus !== null).
   */
  async onLoanIssued(
    msisdn: string,
    repayableNaira: string,
    manager?: EntityManager,
  ): Promise<void> {
    const exec = manager ?? this.dataSource.manager;
    await exec.query(
      `INSERT INTO csdp_subscriber_feature_row (
         msisdn, loans_taken_180d, our_outstanding_kobo, updated_at
       )
       VALUES ($1, 1, ($2::numeric * 100)::bigint, NOW())
       ON CONFLICT (msisdn) DO UPDATE
       SET loans_taken_180d     = csdp_subscriber_feature_row.loans_taken_180d + 1,
           our_outstanding_kobo = csdp_subscriber_feature_row.our_outstanding_kobo
                                  + ($2::numeric * 100)::bigint,
           updated_at           = NOW()`,
      [msisdn, repayableNaira],
    );
  }

  /**
   * Recovery delta: a loan transitioned to RECOVERED. Decrements
   * `our_outstanding_kobo` by `repayableNaira`, increments
   * `loans_recovered_180d`. If the prior status was DEFAULTED, the recovery
   * also cures a default — bump `historical_cured_defaults_180d` and
   * `historical_cured_defaults_lifetime` and clear `uncured_default_exists`
   * if no other defaults remain.
   *
   * `our_outstanding_kobo` is clamped at 0 to defend against drift.
   */
  async onLoanRecovered(
    msisdn: string,
    repayableNaira: string,
    wasDefaulted: boolean,
    manager?: EntityManager,
  ): Promise<void> {
    const exec = manager ?? this.dataSource.manager;

    await exec.query(
      `INSERT INTO csdp_subscriber_feature_row (
         msisdn, loans_recovered_180d, our_outstanding_kobo,
         historical_cured_defaults_180d, historical_cured_defaults_lifetime,
         updated_at
       )
       VALUES ($1, 1, 0, $3, $3, NOW())
       ON CONFLICT (msisdn) DO UPDATE
       SET loans_recovered_180d = csdp_subscriber_feature_row.loans_recovered_180d + 1,
           our_outstanding_kobo = GREATEST(
             csdp_subscriber_feature_row.our_outstanding_kobo - ($2::numeric * 100)::bigint,
             0
           ),
           historical_cured_defaults_180d =
             csdp_subscriber_feature_row.historical_cured_defaults_180d + $3,
           historical_cured_defaults_lifetime =
             csdp_subscriber_feature_row.historical_cured_defaults_lifetime + $3,
           updated_at = NOW()`,
      [msisdn, repayableNaira, wasDefaulted ? 1 : 0],
    );

    if (wasDefaulted) {
      // Clear the flag iff no DEFAULTED loans remain for this MSISDN.
      await exec.query(
        `UPDATE csdp_subscriber_feature_row sfr
         SET uncured_default_exists = EXISTS (
               SELECT 1 FROM csdp_loan
               WHERE msisdn = sfr.msisdn AND status = 'DEFAULTED'
             ),
             updated_at = NOW()
         WHERE sfr.msisdn = $1`,
        [msisdn],
      );
    }
  }
}
