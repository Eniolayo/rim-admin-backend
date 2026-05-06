import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';

/**
 * Computes every column of csdp_subscriber_feature_row from authoritative
 * source tables (csdp_loan, csdp_recovery_loan_item, csdp_cdr_*) per
 * CSDP_SCORING_ALGORITHM §5.4 and §9, and UPSERTs the result.
 *
 * Phase 2 step 1: daily-pass only. Live writers and Redis-backed counters
 * land in steps 4 and 5; this service is the canonical recompute path the
 * daily 03:00 WAT linking job uses to repair drift.
 *
 * The Redis-backed columns (`our_disbursed_24h_naira`, `eligibility_checks_1h`)
 * are derived from PG sources here as a diagnostic mirror; Redis remains
 * authoritative for scoring once step 5 lands.
 */
@Injectable()
export class FeatureRowMaterializerService {
  private readonly logger = new Logger(FeatureRowMaterializerService.name);

  constructor(
    @InjectDataSource('csdpBatch')
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Refresh feature rows for every MSISDN with activity in the last
   * `windowDays` days. Returns the number of rows upserted. Designed to be
   * called from the daily linking job; also safe to call ad-hoc for spot
   * checks.
   */
  async refreshActiveSubscribers(windowDays = 30): Promise<number> {
    const start = Date.now();

    const upserted = await this.dataSource.transaction(async (manager) => {
      const rows: Array<{ count: string }> = await manager.query(
        this.upsertSql(),
        [windowDays],
      );
      return Number(rows?.[0]?.count ?? 0);
    });

    this.logger.log({
      message: 'feature-row materializer complete',
      windowDays,
      upserted,
      tookMs: Date.now() - start,
    });

    return upserted;
  }

  /**
   * Recompute and upsert a single MSISDN. Used by webhook live writers
   * (step 4) and ad-hoc tooling. Returns the upserted row count (0 or 1).
   */
  async refreshOne(msisdn: string, manager?: EntityManager): Promise<number> {
    const exec = manager ?? this.dataSource.manager;
    const rows: Array<{ count: string }> = await exec.query(
      this.upsertSqlSingle(),
      [msisdn],
    );
    return Number(rows?.[0]?.count ?? 0);
  }

  /**
   * Active MSISDNs are the union of:
   *   - subscribers with any csdp_loan whose updated_at falls in the window
   *   - subscribers with any csdp_recovery in the window
   *   - subscribers with any csdp_eligibility_log in the window
   *
   * The feature row is recomputed in full from the source tables so that
   * any drift accrued from live writers is corrected.
   */
  private upsertSql(): string {
    return `
      WITH active AS (
        SELECT DISTINCT msisdn FROM (
          SELECT msisdn FROM csdp_loan WHERE updated_at > NOW() - ($1 || ' days')::interval
          UNION
          SELECT msisdn FROM csdp_recovery WHERE recovered_at > NOW() - ($1 || ' days')::interval
          UNION
          SELECT msisdn FROM csdp_eligibility_log WHERE requested_at > NOW() - ($1 || ' days')::interval
        ) u
      ),
      computed AS (
        ${this.computedColumnsSql('active.msisdn')}
        FROM active
      ),
      upserted AS (
        INSERT INTO csdp_subscriber_feature_row (
          msisdn,
          days_on_network,
          recharge_count_30d,
          loans_taken_180d,
          loans_recovered_180d,
          historical_cured_defaults_180d,
          historical_cured_defaults_lifetime,
          uncured_default_exists,
          our_outstanding_kobo,
          our_disbursed_24h_naira,
          eligibility_checks_1h,
          updated_at
        )
        SELECT
          c.msisdn,
          c.days_on_network,
          c.recharge_count_30d,
          c.loans_taken_180d,
          c.loans_recovered_180d,
          c.historical_cured_defaults_180d,
          c.historical_cured_defaults_lifetime,
          c.uncured_default_exists,
          c.our_outstanding_kobo,
          c.our_disbursed_24h_naira,
          c.eligibility_checks_1h,
          NOW()
        FROM computed c
        ON CONFLICT (msisdn) DO UPDATE SET
          days_on_network                    = EXCLUDED.days_on_network,
          recharge_count_30d                 = EXCLUDED.recharge_count_30d,
          loans_taken_180d                   = EXCLUDED.loans_taken_180d,
          loans_recovered_180d               = EXCLUDED.loans_recovered_180d,
          historical_cured_defaults_180d     = EXCLUDED.historical_cured_defaults_180d,
          historical_cured_defaults_lifetime = EXCLUDED.historical_cured_defaults_lifetime,
          uncured_default_exists             = EXCLUDED.uncured_default_exists,
          our_outstanding_kobo               = EXCLUDED.our_outstanding_kobo,
          our_disbursed_24h_naira            = EXCLUDED.our_disbursed_24h_naira,
          eligibility_checks_1h              = EXCLUDED.eligibility_checks_1h,
          updated_at                         = NOW()
        RETURNING 1
      )
      SELECT COUNT(*)::text AS count FROM upserted
    `;
  }

  private upsertSqlSingle(): string {
    return `
      WITH active AS (SELECT $1::text AS msisdn),
      computed AS (
        ${this.computedColumnsSql('active.msisdn')}
        FROM active
      ),
      upserted AS (
        INSERT INTO csdp_subscriber_feature_row (
          msisdn,
          days_on_network,
          recharge_count_30d,
          loans_taken_180d,
          loans_recovered_180d,
          historical_cured_defaults_180d,
          historical_cured_defaults_lifetime,
          uncured_default_exists,
          our_outstanding_kobo,
          our_disbursed_24h_naira,
          eligibility_checks_1h,
          updated_at
        )
        SELECT
          c.msisdn,
          c.days_on_network,
          c.recharge_count_30d,
          c.loans_taken_180d,
          c.loans_recovered_180d,
          c.historical_cured_defaults_180d,
          c.historical_cured_defaults_lifetime,
          c.uncured_default_exists,
          c.our_outstanding_kobo,
          c.our_disbursed_24h_naira,
          c.eligibility_checks_1h,
          NOW()
        FROM computed c
        ON CONFLICT (msisdn) DO UPDATE SET
          days_on_network                    = EXCLUDED.days_on_network,
          recharge_count_30d                 = EXCLUDED.recharge_count_30d,
          loans_taken_180d                   = EXCLUDED.loans_taken_180d,
          loans_recovered_180d               = EXCLUDED.loans_recovered_180d,
          historical_cured_defaults_180d     = EXCLUDED.historical_cured_defaults_180d,
          historical_cured_defaults_lifetime = EXCLUDED.historical_cured_defaults_lifetime,
          uncured_default_exists             = EXCLUDED.uncured_default_exists,
          our_outstanding_kobo               = EXCLUDED.our_outstanding_kobo,
          our_disbursed_24h_naira            = EXCLUDED.our_disbursed_24h_naira,
          eligibility_checks_1h              = EXCLUDED.eligibility_checks_1h,
          updated_at                         = NOW()
        RETURNING 1
      )
      SELECT COUNT(*)::text AS count FROM upserted
    `;
  }

  /**
   * The shared SELECT that produces every column of the feature row. The
   * caller wraps it with a FROM clause supplying `msisdn` rows.
   *
   * Day-on-network is approximated as days since the earliest activity
   * footprint we have for the MSISDN (first loan, first recovery, first
   * eligibility log, first CDR row). Refined when richer subscriber-create
   * data lands.
   */
  private computedColumnsSql(msisdnExpr: string): string {
    return `
      SELECT
        ${msisdnExpr} AS msisdn,
        COALESCE(
          GREATEST(
            EXTRACT(DAY FROM NOW() - (
              SELECT MIN(first_seen) FROM (
                SELECT MIN(issued_at) AS first_seen FROM csdp_loan WHERE msisdn = ${msisdnExpr}
                UNION ALL
                SELECT MIN(recovered_at) FROM csdp_recovery WHERE msisdn = ${msisdnExpr}
                UNION ALL
                SELECT MIN(requested_at) FROM csdp_eligibility_log WHERE msisdn = ${msisdnExpr}
              ) f
            ))::int,
            0
          ),
          0
        ) AS days_on_network,
        COALESCE((
          SELECT COUNT(*)::int
          FROM csdp_cdr_refill
          WHERE msisdn = ${msisdnExpr}
            AND refilled_at > NOW() - INTERVAL '30 days'
        ), 0) AS recharge_count_30d,
        COALESCE((
          SELECT COUNT(*)::int
          FROM csdp_loan
          WHERE msisdn = ${msisdnExpr}
            AND issued_at > NOW() - INTERVAL '180 days'
        ), 0) AS loans_taken_180d,
        COALESCE((
          SELECT COUNT(*)::int
          FROM csdp_loan
          WHERE msisdn = ${msisdnExpr}
            AND status = 'RECOVERED'
            AND recovered_at > NOW() - INTERVAL '180 days'
        ), 0) AS loans_recovered_180d,
        COALESCE((
          SELECT COUNT(*)::int
          FROM csdp_loan
          WHERE msisdn = ${msisdnExpr}
            AND status = 'RECOVERED'
            AND recovered_at IS NOT NULL
            AND issued_at < recovered_at - INTERVAL '30 days'
            AND recovered_at > NOW() - INTERVAL '180 days'
        ), 0) AS historical_cured_defaults_180d,
        COALESCE((
          SELECT COUNT(*)::int
          FROM csdp_loan
          WHERE msisdn = ${msisdnExpr}
            AND status = 'RECOVERED'
            AND recovered_at IS NOT NULL
            AND issued_at < recovered_at - INTERVAL '30 days'
        ), 0) AS historical_cured_defaults_lifetime,
        EXISTS (
          SELECT 1 FROM csdp_loan
          WHERE msisdn = ${msisdnExpr}
            AND status = 'DEFAULTED'
        ) AS uncured_default_exists,
        COALESCE((
          SELECT (SUM(repayable_naira) * 100)::bigint
          FROM csdp_loan
          WHERE msisdn = ${msisdnExpr}
            AND status IN ('ISSUED', 'PARTIAL')
        ), 0) AS our_outstanding_kobo,
        COALESCE((
          SELECT SUM(repayable_naira)::int
          FROM csdp_loan
          WHERE msisdn = ${msisdnExpr}
            AND issued_at > NOW() - INTERVAL '24 hours'
        ), 0) AS our_disbursed_24h_naira,
        COALESCE((
          SELECT COUNT(*)::int
          FROM csdp_eligibility_log
          WHERE msisdn = ${msisdnExpr}
            AND requested_at > NOW() - INTERVAL '1 hour'
        ), 0) AS eligibility_checks_1h
    `;
  }
}
