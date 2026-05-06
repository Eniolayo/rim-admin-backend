/**
 * `heuristic_v3` — pure-function CSDP scoring.
 *
 * Implements the four scoring stages defined in
 * `docs/CSDP_SCORING_ALGORITHM.md`:
 *   - Stage 1: hard gates (§4)
 *   - Stage 2: score 0–1000 (§5)
 *   - Stage 3: score → base limit (§6)
 *   - Stage 4: real-time clamps (§7)
 *
 * No DB, HTTP, Nest, Redis. Inputs: a feature row + the request fields +
 * the `csdp.*` config snapshot. Output: a decision object suitable for
 * direct write to `csdp_eligibility_log`.
 */

export type CsdpLoanType = 'AIRTIME' | 'DATA' | 'TALKTIME';

export type CsdpGate =
  | 'BLACKLIST'
  | 'OUTSTANDING'
  | 'DA_CAP'
  | 'UNCURED_DEFAULT'
  | 'VELOCITY'
  | 'TYPE_DISABLED';

export interface CsdpFeatureRow {
  msisdn: string;
  blacklisted: boolean;
  daysOnNetwork: number;
  rechargeCount30d: number;
  loansTaken180d: number;
  loansRecovered180d: number;
  historicalCuredDefaults180d: number;
  historicalCuredDefaultsLifetime: number;
  uncuredDefaultExists: boolean;
  ourOutstandingKobo: number;
  ourDisbursed24hNaira: number;
  eligibilityChecks1h: number;
}

export interface CsdpRequest {
  daKobo: number;
  loanType: CsdpLoanType;
}

export interface CsdpAnchors {
  smallMin: number;
  maxLimit: number;
}

export interface CsdpConfig {
  // §5 score
  priorAlpha: number;
  priorBeta: number;
  confidencePseudoN: number;
  evidenceMax: number;
  tenureMultMin: number;
  tenureSatDays: number;
  engagementMultMin: number;
  engagementSat: number;
  coldStartBase: number;
  coldStartMinTenureDays: number;
  coldStartMinEngagement: number;
  /**
   * §5.5 cold-start *cliff* continuity bonus (Phase 3 R-9).
   *
   * When a Population-B subscriber crosses into Population A
   * (`taken >= 1`), the new evidence-based score is unavoidably thin
   * — `confidence = taken / (taken + pseudoN)` is small for the first
   * 1-3 loans, so the limit drops sharply ("the cliff"). Without
   * smoothing, a clean cold-start repayer would see their limit
   * collapse the moment they qualify out.
   *
   * The continuity bonus adds a flat naira amount to the post-Stage-3
   * base limit, decaying linearly across the first
   * `continuityBonusLoanWindow` loans, but only for subscribers with a
   * **perfect** repayment record so far (`recovered === taken`) and
   * who would have been eligible for cold-start by the engagement /
   * tenure floors. The bonus is applied before Stage 4 clamps, so the
   * partner cap, daily user cap, and exposure taper still bound it.
   */
  continuityBonusMaxNaira: number;
  continuityBonusLoanWindow: number;
  penaltyCuredRecent: number;
  penaltyCuredLifetime: number;
  penaltyCuredLifetimeCap: number;
  penaltyVelocity: number;
  velocityThreshold: number;
  // §6 limit curve
  baseThreshold: number;
  thinFileMaxBonus: number;
  thinFileSaturation: number;
  curveExponent: number;
  anchors: Record<CsdpLoanType, CsdpAnchors>;
  // §7 clamps + gates
  partnerCapNaira: number;
  dailyUserCapNaira: Record<CsdpLoanType, number>;
  exposureTaperStartPct: number;
  exposureHaltPct: number;
  velocityExtreme: number;
  loanTypeEnabled: Record<CsdpLoanType, boolean>;
}

/** §11 defaults — kept in sync with the SeedCsdpScoringConfig migration. */
export const DEFAULT_CSDP_CONFIG: CsdpConfig = {
  priorAlpha: 2,
  priorBeta: 2,
  confidencePseudoN: 4,
  evidenceMax: 800,
  tenureMultMin: 0.85,
  tenureSatDays: 365,
  engagementMultMin: 0.7,
  engagementSat: 20,
  coldStartBase: 200,
  coldStartMinTenureDays: 60,
  coldStartMinEngagement: 0.75,
  continuityBonusMaxNaira: 100,
  continuityBonusLoanWindow: 3,
  penaltyCuredRecent: 100,
  penaltyCuredLifetime: 30,
  penaltyCuredLifetimeCap: 150,
  penaltyVelocity: 5,
  velocityThreshold: 3,
  baseThreshold: 300,
  thinFileMaxBonus: 220,
  thinFileSaturation: 6,
  curveExponent: 0.85,
  anchors: {
    AIRTIME: { smallMin: 50, maxLimit: 1500 },
    DATA: { smallMin: 100, maxLimit: 3000 },
    TALKTIME: { smallMin: 50, maxLimit: 1000 },
  },
  partnerCapNaira: 5000,
  dailyUserCapNaira: { AIRTIME: 1500, DATA: 3000, TALKTIME: 1000 },
  exposureTaperStartPct: 0.85,
  exposureHaltPct: 0.95,
  velocityExtreme: 10,
  loanTypeEnabled: { AIRTIME: true, DATA: true, TALKTIME: true },
};

export interface CsdpScoreComponents {
  posteriorRate: number;
  confidence: number;
  evidenceScore: number;
  tenureMult: number;
  engagementMult: number;
  stability: number;
  base: number;
  thinFileBonus: number;
  effectiveThreshold: number;
  penaltyBreakdown: {
    curedRecent: number;
    curedLifetime: number;
    velocity: number;
    total: number;
  };
  coldStartUsed: boolean;
  /** Naira added to the base limit pre-Stage-4 by §5.5 continuity bonus. */
  continuityBonusNaira: number;
}

export interface CsdpScoreResult {
  /** 0–1000, integer. Always present (gates set this to 0). */
  score: number;
  components: CsdpScoreComponents;
  /** Output of Stage 3, before Stage 4 clamps. */
  baseLimitNaira: number;
  /** Stage 4 inputs/headroom for log. */
  partnerResidualNaira: number;
  dailyUserRemainingNaira: number;
  systemExposurePct: number;
  /** Final naira limit (response payload). */
  finalLimitNaira: number;
  /** Non-null only when Stage 1 short-circuits. */
  gateFailed: CsdpGate | null;
  modelVersion: 'heuristic_v3';
}

const ZERO_COMPONENTS: CsdpScoreComponents = {
  posteriorRate: 0,
  confidence: 0,
  evidenceScore: 0,
  tenureMult: 0,
  engagementMult: 0,
  stability: 0,
  base: 0,
  thinFileBonus: 0,
  effectiveThreshold: 0,
  penaltyBreakdown: { curedRecent: 0, curedLifetime: 0, velocity: 0, total: 0 },
  coldStartUsed: false,
  continuityBonusNaira: 0,
};

export interface ScoreV3Inputs {
  features: CsdpFeatureRow;
  request: CsdpRequest;
  /** Live system-exposure ratio [0..∞) — Redis-sourced in Phase 2. */
  systemExposurePct: number;
  config?: CsdpConfig;
}

/**
 * Stage 1 — hard gates. Returns the failing gate or null.
 * §4 of CSDP_SCORING_ALGORITHM.md.
 */
function stage1Gates(
  f: CsdpFeatureRow,
  r: CsdpRequest,
  c: CsdpConfig,
): CsdpGate | null {
  if (f.blacklisted) return 'BLACKLIST';
  if (f.ourOutstandingKobo > 0) return 'OUTSTANDING';
  if (r.daKobo >= c.partnerCapNaira * 100) return 'DA_CAP';
  if (f.uncuredDefaultExists) return 'UNCURED_DEFAULT';
  if (f.eligibilityChecks1h >= c.velocityExtreme) return 'VELOCITY';
  if (!c.loanTypeEnabled[r.loanType]) return 'TYPE_DISABLED';
  return null;
}

/**
 * Stage 2 — score 0..1000. Returns the integer score plus the full
 * components breakdown for logging.
 */
function stage2Score(
  f: CsdpFeatureRow,
  c: CsdpConfig,
): { score: number; components: CsdpScoreComponents } {
  const taken = f.loansTaken180d;
  const recovered = f.loansRecovered180d;

  const posteriorRate =
    (recovered + c.priorAlpha) / (taken + c.priorAlpha + c.priorBeta);
  const confidence = taken / (taken + c.confidencePseudoN);
  const evidenceScore = c.evidenceMax * posteriorRate * confidence;

  const tenureMult =
    c.tenureMultMin +
    (1 - c.tenureMultMin) * Math.tanh(f.daysOnNetwork / c.tenureSatDays);
  const engagementMult =
    c.engagementMultMin +
    (1 - c.engagementMultMin) *
      Math.tanh(f.rechargeCount30d / c.engagementSat);
  const stability = Math.min(tenureMult, engagementMult);

  let base = evidenceScore * stability;
  let coldStartUsed = false;

  // §5.3 cold-start path — only when Population B
  if (
    taken === 0 &&
    f.daysOnNetwork >= c.coldStartMinTenureDays &&
    engagementMult >= c.coldStartMinEngagement &&
    !f.uncuredDefaultExists
  ) {
    base = c.coldStartBase * engagementMult;
    coldStartUsed = true;
  }

  // §5.4 penalties
  const curedRecent = c.penaltyCuredRecent * f.historicalCuredDefaults180d;
  const curedLifetime = Math.min(
    c.penaltyCuredLifetimeCap,
    c.penaltyCuredLifetime * f.historicalCuredDefaultsLifetime,
  );
  const velocity =
    c.penaltyVelocity *
    Math.max(0, f.eligibilityChecks1h - c.velocityThreshold);
  const totalPenalty = curedRecent + curedLifetime + velocity;

  const score = Math.max(0, Math.min(1000, Math.round(base - totalPenalty)));

  // §6.1 thin-file bonus + effective threshold (kept here for log convenience)
  const frac = Math.max(0, 1 - taken / c.thinFileSaturation);
  const thinFileBonus = c.thinFileMaxBonus * frac * frac;
  const effectiveThreshold = c.baseThreshold - thinFileBonus;

  // §5.5 cold-start cliff continuity bonus. Applied to the base limit
  // (Stage 3 output), not the score, so it cannot break gates and Stage 4
  // clamps still bound it. Conservative gates: must have a perfect
  // repayment record so far and meet the tenure / engagement floors that
  // a fresh cold-start subscriber would have to clear.
  const window = Math.max(0, c.continuityBonusLoanWindow);
  const eligibleForContinuity =
    taken >= 1 &&
    taken <= window &&
    recovered === taken &&
    !f.uncuredDefaultExists &&
    f.daysOnNetwork >= c.coldStartMinTenureDays &&
    engagementMult >= c.coldStartMinEngagement;
  const continuityBonusNaira = eligibleForContinuity
    ? c.continuityBonusMaxNaira * (1 - (taken - 1) / window)
    : 0;

  return {
    score,
    components: {
      posteriorRate,
      confidence,
      evidenceScore,
      tenureMult,
      engagementMult,
      stability,
      base,
      thinFileBonus,
      effectiveThreshold,
      penaltyBreakdown: {
        curedRecent,
        curedLifetime,
        velocity,
        total: totalPenalty,
      },
      coldStartUsed,
      continuityBonusNaira,
    },
  };
}

/**
 * Stage 3 — score → base limit (₦, integer floor).
 * §6 of CSDP_SCORING_ALGORITHM.md.
 */
function stage3BaseLimit(
  score: number,
  effectiveThreshold: number,
  loanType: CsdpLoanType,
  c: CsdpConfig,
): number {
  if (score < effectiveThreshold) return 0;
  const span = 1000 - effectiveThreshold;
  if (span <= 0) return 0;
  const progress = Math.pow((score - effectiveThreshold) / span, c.curveExponent);
  const { smallMin, maxLimit } = c.anchors[loanType];
  const raw = smallMin + (maxLimit - smallMin) * progress;
  return Math.max(0, raw);
}

/**
 * Stage 4 — clamps. Returns the headroom values for logging plus the
 * final naira limit (integer floor, ≥ 0).
 */
function stage4Clamps(
  baseLimitFloat: number,
  request: CsdpRequest,
  feature: CsdpFeatureRow,
  exposurePct: number,
  c: CsdpConfig,
): {
  finalLimitNaira: number;
  partnerResidualNaira: number;
  dailyUserRemainingNaira: number;
} {
  const partnerResidualNaira =
    c.partnerCapNaira - Math.floor(request.daKobo / 100);
  const dailyUserRemainingNaira =
    c.dailyUserCapNaira[request.loanType] - feature.ourDisbursed24hNaira;

  let limit = baseLimitFloat;
  limit = Math.min(limit, partnerResidualNaira);
  limit = Math.min(limit, dailyUserRemainingNaira);

  if (exposurePct >= c.exposureHaltPct) {
    limit = 0;
  } else if (exposurePct >= c.exposureTaperStartPct) {
    const taper =
      1 -
      (exposurePct - c.exposureTaperStartPct) /
        (c.exposureHaltPct - c.exposureTaperStartPct);
    limit = limit * taper;
  }

  return {
    finalLimitNaira: Math.floor(Math.max(0, limit)),
    partnerResidualNaira,
    dailyUserRemainingNaira,
  };
}

/**
 * Run the full heuristic_v3 pipeline. Pure: output is a function of inputs.
 */
export function scoreV3(inputs: ScoreV3Inputs): CsdpScoreResult {
  const config = inputs.config ?? DEFAULT_CSDP_CONFIG;
  const { features, request, systemExposurePct } = inputs;

  const gateFailed = stage1Gates(features, request, config);
  if (gateFailed) {
    return {
      score: 0,
      components: ZERO_COMPONENTS,
      baseLimitNaira: 0,
      partnerResidualNaira:
        config.partnerCapNaira - Math.floor(request.daKobo / 100),
      dailyUserRemainingNaira:
        config.dailyUserCapNaira[request.loanType] - features.ourDisbursed24hNaira,
      systemExposurePct,
      finalLimitNaira: 0,
      gateFailed,
      modelVersion: 'heuristic_v3',
    };
  }

  const { score, components } = stage2Score(features, config);

  const baseLimitFloat = stage3BaseLimit(
    score,
    components.effectiveThreshold,
    request.loanType,
    config,
  );

  // §5.5 — apply continuity bonus to the base limit before Stage 4
  // clamps. The bonus exists precisely to bridge the cliff where a
  // clean cold-start repayer's evidence-based score hasn't yet
  // accumulated enough to clear the thin-file threshold; the
  // continuity-bonus gates in stage2 (perfect repayment, tenure /
  // engagement floors) are what justify paying out even when the
  // underlying base limit is zero.
  const bonusedBaseLimit = baseLimitFloat + components.continuityBonusNaira;

  const { finalLimitNaira, partnerResidualNaira, dailyUserRemainingNaira } =
    stage4Clamps(bonusedBaseLimit, request, features, systemExposurePct, config);

  return {
    score,
    components,
    baseLimitNaira: Math.floor(baseLimitFloat),
    partnerResidualNaira,
    dailyUserRemainingNaira,
    systemExposurePct,
    finalLimitNaira,
    gateFailed: null,
    modelVersion: 'heuristic_v3',
  };
}
