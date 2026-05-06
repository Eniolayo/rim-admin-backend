import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CsdpFeatureRow } from '../csdp-scoring/heuristic-v3';
import { CsdpLiveCountersService } from './csdp-live-counters.service';

/**
 * Composes the `CsdpFeatureRow` shape consumed by `heuristic_v3` from
 * three sources:
 *   - `csdp_subscriber_feature_row` (PG, daily-materialized + live-written)
 *   - `csdp_credit_profile.blacklisted` (PG, admin-managed)
 *   - Redis live counters (`disbursed24h:{msisdn}`, `elig1h:{msisdn}`)
 *
 * If the PG row does not exist (cold MSISDN), every numeric column
 * defaults to 0 and `uncuredDefaultExists` to false. Stage-1 cold-start
 * gates handle that case.
 */
@Injectable()
export class FeatureRowReadModel {
  constructor(
    @InjectDataSource('csdpBatch')
    private readonly dataSource: DataSource,
    private readonly counters: CsdpLiveCountersService,
  ) {}

  async read(msisdn: string): Promise<CsdpFeatureRow> {
    const [pgRow, blacklisted, disbursed24h, eligChecks1h] = await Promise.all([
      this.readFeatureRow(msisdn),
      this.readBlacklisted(msisdn),
      this.counters.sumDisbursed24hNaira(msisdn),
      this.counters.getEligibilityChecks1h(msisdn),
    ]);

    return {
      msisdn,
      blacklisted,
      daysOnNetwork: pgRow.daysOnNetwork,
      rechargeCount30d: pgRow.rechargeCount30d,
      loansTaken180d: pgRow.loansTaken180d,
      loansRecovered180d: pgRow.loansRecovered180d,
      historicalCuredDefaults180d: pgRow.historicalCuredDefaults180d,
      historicalCuredDefaultsLifetime: pgRow.historicalCuredDefaultsLifetime,
      uncuredDefaultExists: pgRow.uncuredDefaultExists,
      ourOutstandingKobo: pgRow.ourOutstandingKobo,
      ourDisbursed24hNaira: disbursed24h,
      eligibilityChecks1h: eligChecks1h,
    };
  }

  async readSystemExposurePct(): Promise<number> {
    return this.counters.getSystemExposurePct();
  }

  private async readFeatureRow(msisdn: string): Promise<{
    daysOnNetwork: number;
    rechargeCount30d: number;
    loansTaken180d: number;
    loansRecovered180d: number;
    historicalCuredDefaults180d: number;
    historicalCuredDefaultsLifetime: number;
    uncuredDefaultExists: boolean;
    ourOutstandingKobo: number;
  }> {
    const rows: Array<{
      days_on_network: number;
      recharge_count_30d: number;
      loans_taken_180d: number;
      loans_recovered_180d: number;
      historical_cured_defaults_180d: number;
      historical_cured_defaults_lifetime: number;
      uncured_default_exists: boolean;
      our_outstanding_kobo: string;
    }> = await this.dataSource.query(
      `SELECT days_on_network, recharge_count_30d,
              loans_taken_180d, loans_recovered_180d,
              historical_cured_defaults_180d, historical_cured_defaults_lifetime,
              uncured_default_exists, our_outstanding_kobo
       FROM csdp_subscriber_feature_row
       WHERE msisdn = $1`,
      [msisdn],
    );
    const row = rows?.[0];
    if (!row) {
      return {
        daysOnNetwork: 0,
        rechargeCount30d: 0,
        loansTaken180d: 0,
        loansRecovered180d: 0,
        historicalCuredDefaults180d: 0,
        historicalCuredDefaultsLifetime: 0,
        uncuredDefaultExists: false,
        ourOutstandingKobo: 0,
      };
    }
    return {
      daysOnNetwork: row.days_on_network,
      rechargeCount30d: row.recharge_count_30d,
      loansTaken180d: row.loans_taken_180d,
      loansRecovered180d: row.loans_recovered_180d,
      historicalCuredDefaults180d: row.historical_cured_defaults_180d,
      historicalCuredDefaultsLifetime: row.historical_cured_defaults_lifetime,
      uncuredDefaultExists: row.uncured_default_exists,
      ourOutstandingKobo: Number(row.our_outstanding_kobo),
    };
  }

  private async readBlacklisted(msisdn: string): Promise<boolean> {
    const rows: Array<{ blacklisted: boolean }> = await this.dataSource.query(
      `SELECT blacklisted FROM csdp_credit_profile WHERE msisdn = $1`,
      [msisdn],
    );
    return rows?.[0]?.blacklisted ?? false;
  }
}
