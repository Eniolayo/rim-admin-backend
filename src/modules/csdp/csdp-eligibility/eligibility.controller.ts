import {
  Controller,
  Get,
  HttpCode,
  Logger,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { DecisionRouterService, DecisionContext, DecisionResult } from './decision-router.service';
import { EligibilityLoggerService } from './eligibility-logger.service';
import { ProfileIdempotencyService } from './profile-idempotency.service';
import { CsdpLiveCountersService } from '../csdp-linking/csdp-live-counters.service';
import { CsdpScoringService, ScoreOutput } from '../csdp-scoring/csdp-scoring.service';
import { EligibilitySnapshotService } from './eligibility-snapshot.service';
import { EligibilityRequestDto } from './dto/eligibility-request.dto';
import { Public } from '../../auth/decorators/public.decorator';
import { CsdpApiKeyGuard } from '../../auth/guards/csdp-api-key.guard';
import { CsdpScopes } from '../../auth/decorators/csdp-scopes.decorator';
import { DecisionMode } from '../csdp-feature-flags/csdp-feature-flags.service';
import { toE164Nigerian, maskMsisdn } from '../../../common/utils/phone.utils';
import { koboToNaira } from '../../../common/utils/money.utils';

/**
 * Response shape per Airtel CSDP `/profile` contract
 * (see docs/AIRTEL_CSDP_INTEGRATION_API.md §1):
 *   { "message": "<integer naira limit as string>" }
 *
 * `"0"` means deny. The default mode is `STUB_DENY`, which always
 * returns `"0"`; any unset / malformed `DECISION_MODE` flag value
 * also resolves to `STUB_DENY` in `DecisionRouterService.decide`.
 */
export interface EligibilityResponse {
  message: string;
}

@Controller('profile')
export class EligibilityController {
  private readonly log = new Logger(EligibilityController.name);

  constructor(
    private readonly router: DecisionRouterService,
    private readonly logger: EligibilityLoggerService,
    private readonly idempotency: ProfileIdempotencyService,
    private readonly counters: CsdpLiveCountersService,
    private readonly scoring: CsdpScoringService,
    private readonly snapshot: EligibilitySnapshotService,
  ) {}

  @Get()
  @Public()
  @UseGuards(CsdpApiKeyGuard)
  @CsdpScopes('csdp:profile')
  @HttpCode(200)
  async profile(
    @Query() query: EligibilityRequestDto,
  ): Promise<EligibilityResponse> {
    const msisdn = toE164Nigerian(query.msisdn);
    if (!msisdn) throw new BadRequestException('Invalid MSISDN');

    // trans_ref is the partner's idempotency key. If we've already decided
    // on this trans_ref within the cache window, return the prior decision
    // verbatim — never recompute.
    const cached = await this.idempotency.lookup(query.trans_ref);
    if (cached) {
      return { message: cached.responseLimitNaira };
    }

    // `da` is the only kobo value we accept; convert at the boundary.
    // Audit log keeps the raw kobo string verbatim for traceability.
    const daKoboRaw: string | null = query.da ?? null;
    const daNaira: string | null =
      daKoboRaw !== null ? koboToNaira(daKoboRaw) : null;

    const ctx: DecisionContext = {
      msisdn,
      transRef: query.trans_ref,
      daKoboRaw,
      daNaira,
      loanType: query.type,
      receivedAt: Date.now(),
    };

    // Velocity counter (heuristic_v3 §4 / §5.4) — increment per distinct
    // trans_ref so cache hits do not double-count. Failures must not break
    // the request; the daily materializer recomputes the PG mirror nightly.
    void this.counters
      .incrEligibilityCheck(msisdn)
      .catch(() => undefined);

    // Phase 2 step 8 — dual-run shadow harness. The legacy decision is
    // returned to the customer; heuristic_v3 runs alongside, with its
    // result + the input feature row persisted to the snapshot/log
    // tables. Scoring failures must never affect the customer response.
    const budgetMs = 1500;
    const timeout = <T,>(p: Promise<T>): Promise<T> =>
      Promise.race([
        p,
        new Promise<T>((_, rej) =>
          setTimeout(() => rej(new Error('budget_exceeded')), budgetMs),
        ),
      ]);

    const [legacy, scoreOutput] = await Promise.all([
      timeout(this.router.decide(ctx)).catch((err: Error) =>
        this.fallback(ctx, err),
      ),
      timeout(
        this.scoring.score({
          msisdn,
          daKobo: daKoboRaw === null ? 0 : Number(daKoboRaw),
          loanType: query.type,
        }),
      ).catch((err: Error) => {
        this.log.warn(
          `scoring failed for trans_ref=${query.trans_ref}: ${err.message}`,
        );
        return null as ScoreOutput | null;
      }),
    ]);

    // Phase 3 — apply decision mode. For SHADOW, this returns `legacy`
    // unchanged (Phase 2 behavior). For LIVE_5/LIVE_50, in-cohort
    // MSISDNs see heuristic_v3; the rest stay on legacy and the served
    // decisionMode is rewritten to SHADOW so logs/dashboards can tell
    // the flag-state apart from the served-path. For LIVE, all traffic
    // is heuristic_v3.
    const result = this.router.selectFinal(ctx, legacy.decisionMode, legacy, scoreOutput);

    // Snapshot + audit log fire-and-forget so failures don't block the
    // response (Profile p99 budget < 500 ms). The snapshot is keyed on
    // `trans_ref` and uses ON CONFLICT DO NOTHING.
    if (scoreOutput) {
      void this.snapshot
        .write(query.trans_ref, msisdn, scoreOutput.features)
        .catch(() => undefined);
      void this.logger.enqueue(ctx, result, scoreOutput.result, result.decisionMode);
      this.emitShadowComparison(ctx, legacy, scoreOutput, result);
    } else {
      void this.logger.enqueue(ctx, result);
    }

    return { message: result.responseLimitNaira };
  }

  /**
   * Structured single-line comparison record for ad-hoc tail/grep analysis.
   * MSISDN is masked. Includes both the configured `decision_mode` flag
   * value and the actually-served path so a per-slice dashboard can split
   * by either.
   */
  private emitShadowComparison(
    ctx: DecisionContext,
    legacy: DecisionResult,
    scoring: ScoreOutput,
    served: DecisionResult,
  ): void {
    const legacyNaira = Number(legacy.responseLimitNaira) || 0;
    const servedNaira = Number(served.responseLimitNaira) || 0;
    this.log.log({
      message: 'csdp_shadow_comparison',
      decision_mode: legacy.decisionMode,
      served_mode: served.decisionMode,
      served_winner: served.winner,
      trans_ref: ctx.transRef,
      msisdn_masked: maskMsisdn(ctx.msisdn),
      loan_type: ctx.loanType,
      legacy_winner: legacy.winner,
      legacy_limit_naira: legacyNaira,
      heuristic_v3_limit_naira: scoring.result.finalLimitNaira,
      served_limit_naira: servedNaira,
      diff_naira: scoring.result.finalLimitNaira - legacyNaira,
      gate_failed: scoring.result.gateFailed,
      score: scoring.result.score,
      system_exposure_pct: scoring.systemExposurePct,
    });
  }

  private fallback(ctx: DecisionContext, err: Error): DecisionResult {
    return {
      responseLimitNaira: '0',
      teamweeLimitNaira: null,
      rimLimitNaira: null,
      winner: 'FALLBACK',
      decisionMode: 'STUB_DENY' as DecisionMode,
      teamweeLatencyMs: null,
      rimLatencyMs: null,
      totalLatencyMs: Date.now() - ctx.receivedAt,
      errorReason: err.message ?? 'unknown',
    };
  }
}
