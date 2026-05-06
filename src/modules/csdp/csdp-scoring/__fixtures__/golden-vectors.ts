/**
 * Golden test vectors for `heuristic_v3`.
 *
 * Sourced verbatim from `docs/CSDP_SCORING_ALGORITHM.md`:
 *   - §5.1 calibration table
 *   - §6.1 threshold table
 *   - §12 worked examples (Adaeze / Tunde / Funmi / Bola / Chinedu / Emeka
 *     are conceptual personas; the doc lists three concrete examples A/B/C
 *     plus the §13 dead-zone progression. Both are encoded below.)
 *
 * The spec is the source of truth — never adjust a vector to make a test
 * pass; fix the implementation instead.
 */

import { CsdpFeatureRow, CsdpLoanType } from '../heuristic-v3';

/** §5.1 — perfect repayment posterior + confidence + evidence_score. */
export interface CalibrationVector {
  taken: number;
  recovered: number;
  posterior: number;
  confidence: number;
  evidence: number;
}

export const CALIBRATION_VECTORS: CalibrationVector[] = [
  { taken: 0, recovered: 0, posterior: 0.5, confidence: 0.0, evidence: 0 },
  { taken: 1, recovered: 1, posterior: 0.6, confidence: 0.2, evidence: 96 },
  { taken: 3, recovered: 3, posterior: 0.714, confidence: 0.429, evidence: 245 },
  { taken: 5, recovered: 5, posterior: 0.778, confidence: 0.556, evidence: 346 },
  { taken: 10, recovered: 10, posterior: 0.857, confidence: 0.714, evidence: 490 },
  { taken: 20, recovered: 20, posterior: 0.917, confidence: 0.833, evidence: 611 },
  { taken: 50, recovered: 50, posterior: 0.961, confidence: 0.926, evidence: 712 },
];

/** §6.1 — thin-file bonus + effective threshold by `taken_180d`. */
export interface ThresholdVector {
  taken: number;
  bonus: number;
  threshold: number;
}

export const THRESHOLD_VECTORS: ThresholdVector[] = [
  { taken: 0, bonus: 220.0, threshold: 80.0 },
  { taken: 1, bonus: 152.8, threshold: 147.2 },
  { taken: 2, bonus: 97.8, threshold: 202.2 },
  { taken: 3, bonus: 55.0, threshold: 245.0 },
  { taken: 4, bonus: 24.4, threshold: 275.6 },
  { taken: 5, bonus: 6.1, threshold: 293.9 },
  { taken: 6, bonus: 0.0, threshold: 300.0 },
];

export interface WorkedExample {
  name: string;
  features: CsdpFeatureRow;
  request: { daKobo: number; loanType: CsdpLoanType };
  systemExposurePct: number;
  expected: {
    score: number;
    finalLimitNaira: number;
    gateFailed?: string | null;
  };
}

const baseFeatures = (overrides: Partial<CsdpFeatureRow> = {}): CsdpFeatureRow => ({
  msisdn: '2340000000000',
  blacklisted: false,
  daysOnNetwork: 730,
  rechargeCount30d: 12,
  loansTaken180d: 0,
  loansRecovered180d: 0,
  historicalCuredDefaults180d: 0,
  historicalCuredDefaultsLifetime: 0,
  uncuredDefaultExists: false,
  ourOutstandingKobo: 0,
  ourDisbursed24hNaira: 0,
  eligibilityChecks1h: 1,
  ...overrides,
});

/**
 * §12 worked examples. The spec gives three; we extend with the §13 cliff
 * progression and an uncured / cured-default check, both of which the spec
 * explicitly enumerates.
 */
export const WORKED_EXAMPLES: WorkedExample[] = [
  // §12 Example A — thin-file 4/4 → DENIED on DATA
  {
    name: 'Funmi: thin-file 4/4 DATA — DENIED',
    features: baseFeatures({
      loansTaken180d: 4,
      loansRecovered180d: 4,
    }),
    request: { daKobo: 80000, loanType: 'DATA' },
    systemExposurePct: 0.4,
    expected: { score: 258, finalLimitNaira: 0, gateFailed: null },
  },
  // §12 Example B — cold-start eligible
  {
    name: 'Adaeze: cold-start AIRTIME — APPROVED ₦237',
    features: baseFeatures({
      daysOnNetwork: 180,
      rechargeCount30d: 8,
      loansTaken180d: 0,
      loansRecovered180d: 0,
    }),
    request: { daKobo: 0, loanType: 'AIRTIME' },
    systemExposurePct: 0.3,
    expected: { score: 163, finalLimitNaira: 237, gateFailed: null },
  },
  // §12 Example C — established 12/12 DATA
  {
    name: 'Bola: established 12/12 DATA — APPROVED ₦891',
    features: baseFeatures({
      loansTaken180d: 12,
      loansRecovered180d: 12,
    }),
    request: { daKobo: 80000, loanType: 'DATA' },
    systemExposurePct: 0.4,
    expected: { score: 452, finalLimitNaira: 891, gateFailed: null },
  },
  // §4 — uncured default hard gate (Population A short-circuit)
  {
    name: 'Chinedu: uncured default — gate UNCURED_DEFAULT',
    features: baseFeatures({
      loansTaken180d: 12,
      loansRecovered180d: 11,
      uncuredDefaultExists: true,
    }),
    request: { daKobo: 0, loanType: 'AIRTIME' },
    systemExposurePct: 0.3,
    expected: { score: 0, finalLimitNaira: 0, gateFailed: 'UNCURED_DEFAULT' },
  },
  // §5.4 — cured default penalty
  {
    name: 'Emeka: 12/12 + 1 cured-default-180d — penalty 100 → score 352',
    features: baseFeatures({
      loansTaken180d: 12,
      loansRecovered180d: 12,
      historicalCuredDefaults180d: 1,
    }),
    request: { daKobo: 80000, loanType: 'DATA' },
    systemExposurePct: 0.4,
    expected: { score: 352, finalLimitNaira: 418, gateFailed: null },
  },
  // §13 dead-zone — Tunde-style cliff after one successful repayment.
  // Pre-Phase-3 expectation was finalLimitNaira: 0 (the cliff). With
  // §5.5 continuity bonus enabled (Phase 3), a clean 1/1 cohort
  // receives the full bonus, smoothing the transition out of cold-
  // start. The score stays sub-threshold (83 < effectiveThreshold) so
  // baseLimitNaira is still 0; the bonus alone carries the limit.
  {
    name: 'Tunde: 1/1 DATA — APPROVED ₦100 via continuity bonus',
    features: baseFeatures({
      loansTaken180d: 1,
      loansRecovered180d: 1,
    }),
    request: { daKobo: 0, loanType: 'DATA' },
    systemExposurePct: 0.3,
    expected: { score: 83, finalLimitNaira: 100, gateFailed: null },
  },
];

/** Stage 4 clamp vectors — exposure taper between 0.85 and 0.95. */
export interface Stage4ClampVector {
  name: string;
  baseLimit: number;
  exposurePct: number;
  expectedAfterTaper: number;
}

export const STAGE4_CLAMP_VECTORS: Stage4ClampVector[] = [
  { name: 'no taper at 0.84', baseLimit: 1000, exposurePct: 0.84, expectedAfterTaper: 1000 },
  { name: '50% taper at 0.90', baseLimit: 1000, exposurePct: 0.9, expectedAfterTaper: 500 },
  { name: 'halt at 0.95', baseLimit: 1000, exposurePct: 0.95, expectedAfterTaper: 0 },
  { name: 'halt above 0.95', baseLimit: 1000, exposurePct: 0.97, expectedAfterTaper: 0 },
];
