import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { SystemConfigService } from '../../system-config/services/system-config.service';
import { CsdpLiveCountersService } from '../csdp-linking/csdp-live-counters.service';

/**
 * Recomputes `system_exposure_pct = book_outstanding_24h_kobo / budget_kobo`
 * from authoritative tables and `SYSTEM_CONFIG`, then writes it to Redis
 * with a short TTL so a stalled publisher decays into "no taper" rather
 * than wedging Stage 4 on stale data.
 *
 * Driven by the 30 s Bull repeatable in [exposure-publisher.scheduler.ts].
 *
 * Pre-LIVE the budget is seeded as `0`; the publisher emits `0` (no
 * taper, halt suppressed) until ops sets a real budget — matches the
 * Phase 2 / Phase 3 split in CSDP_MIGRATION_PHASES.md.
 */
@Injectable()
export class ExposurePublisherService {
  private readonly logger = new Logger(ExposurePublisherService.name);

  constructor(
    @InjectDataSource('csdpBatch')
    private readonly dataSource: DataSource,
    private readonly counters: CsdpLiveCountersService,
    private readonly systemConfig: SystemConfigService,
  ) {}

  /** Single publish cycle. Returns the computed pct for tests/logging. */
  async publishOnce(): Promise<number> {
    const [bookKobo, budgetKobo] = await Promise.all([
      this.computeBookOutstanding24hKobo(),
      this.readBudgetKobo(),
    ]);

    const pct = budgetKobo > 0 ? bookKobo / budgetKobo : 0;

    await this.counters.setSystemExposurePct(pct);

    this.logger.debug({
      message: 'system_exposure_pct published',
      bookKobo,
      budgetKobo,
      pct,
    });

    return pct;
  }

  private async computeBookOutstanding24hKobo(): Promise<number> {
    const rows: Array<{ kobo: string | null }> = await this.dataSource.query(
      `SELECT COALESCE(SUM(repayable_naira) * 100, 0)::bigint::text AS kobo
       FROM csdp_loan
       WHERE status IN ('ISSUED', 'PARTIAL')
         AND issued_at > NOW() - INTERVAL '24 hours'`,
    );
    return Number(rows?.[0]?.kobo ?? 0);
  }

  private async readBudgetKobo(): Promise<number> {
    const value = await this.systemConfig.getValue<number>(
      'csdp_scoring',
      'csdp.exposure.budget_kobo',
      0,
    );
    return Number(value) || 0;
  }
}
