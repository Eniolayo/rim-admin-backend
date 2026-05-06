/**
 * Golden suite for `heuristic_v3` (CSDP_SCORING_ALGORITHM.md).
 *
 * Three vector tables drive the suite:
 *   - CALIBRATION_VECTORS (§5.1) — Bayesian posterior + evidence_score
 *   - THRESHOLD_VECTORS (§6.1) — thin-file bonus + effective threshold
 *   - WORKED_EXAMPLES (§12 + §13 cliff progression) — full pipeline
 *   - STAGE4_CLAMP_VECTORS — exposure taper
 *
 * The spec is the source of truth. If a vector fails, fix the code, not
 * the fixture.
 */

import { DEFAULT_CSDP_CONFIG, scoreV3 } from './heuristic-v3';
import {
  CALIBRATION_VECTORS,
  STAGE4_CLAMP_VECTORS,
  THRESHOLD_VECTORS,
  WORKED_EXAMPLES,
} from './__fixtures__/golden-vectors';

describe('heuristic_v3 — §5.1 Bayesian calibration', () => {
  for (const v of CALIBRATION_VECTORS) {
    it(`${v.taken}/${v.recovered} → posterior ${v.posterior}, confidence ${v.confidence}, evidence ${v.evidence}`, () => {
      const result = scoreV3({
        features: {
          msisdn: '2340000000000',
          blacklisted: false,
          daysOnNetwork: 0, // strip stability — not under test here
          rechargeCount30d: 0,
          loansTaken180d: v.taken,
          loansRecovered180d: v.recovered,
          historicalCuredDefaults180d: 0,
          historicalCuredDefaultsLifetime: 0,
          uncuredDefaultExists: false,
          ourOutstandingKobo: 0,
          ourDisbursed24hNaira: 0,
          eligibilityChecks1h: 0,
        },
        request: { daKobo: 0, loanType: 'AIRTIME' },
        systemExposurePct: 0,
      });
      // The spec's §5.1 table rounds intermediates to 3 dp before computing
      // evidence. Our impl uses full precision throughout. 2 dp tolerance
      // covers the spec's pre-rounding error (e.g. 50/50 row writes 0.961
      // but 52/54 = 0.9630).
      expect(result.components.posteriorRate).toBeCloseTo(v.posterior, 2);
      expect(result.components.confidence).toBeCloseTo(v.confidence, 2);
      expect(Math.round(result.components.evidenceScore)).toBeGreaterThanOrEqual(
        v.evidence - 2,
      );
      expect(Math.round(result.components.evidenceScore)).toBeLessThanOrEqual(
        v.evidence + 2,
      );
    });
  }
});

describe('heuristic_v3 — §6.1 threshold table', () => {
  for (const v of THRESHOLD_VECTORS) {
    it(`taken=${v.taken} → bonus ${v.bonus}, threshold ${v.threshold}`, () => {
      const result = scoreV3({
        features: {
          msisdn: '2340000000000',
          blacklisted: false,
          daysOnNetwork: 730,
          rechargeCount30d: 12,
          loansTaken180d: v.taken,
          loansRecovered180d: v.taken,
          historicalCuredDefaults180d: 0,
          historicalCuredDefaultsLifetime: 0,
          uncuredDefaultExists: false,
          ourOutstandingKobo: 0,
          ourDisbursed24hNaira: 0,
          eligibilityChecks1h: 0,
        },
        request: { daKobo: 0, loanType: 'AIRTIME' },
        systemExposurePct: 0,
      });
      expect(result.components.thinFileBonus).toBeCloseTo(v.bonus, 1);
      expect(result.components.effectiveThreshold).toBeCloseTo(v.threshold, 1);
    });
  }
});

describe('heuristic_v3 — §12 + §13 worked examples', () => {
  for (const ex of WORKED_EXAMPLES) {
    it(ex.name, () => {
      const result = scoreV3({
        features: ex.features,
        request: ex.request,
        systemExposurePct: ex.systemExposurePct,
      });
      expect(result.score).toBe(ex.expected.score);
      expect(result.finalLimitNaira).toBe(ex.expected.finalLimitNaira);
      expect(result.gateFailed).toBe(ex.expected.gateFailed ?? null);
      expect(result.modelVersion).toBe('heuristic_v3');
    });
  }
});

describe('heuristic_v3 — §5.5 cold-start cliff continuity bonus', () => {
  // Subscriber who would have been Adaeze pre-first-loan (clean
  // cold-start eligibility) but has now taken her first loan and
  // repaid it cleanly. Without the bonus, evidence is too thin and the
  // limit collapses; with the bonus, she crosses the threshold and
  // the bonus tops up the base limit before Stage 4 clamps.
  const cleanFirstLoanFeatures = {
    msisdn: '2340000000000',
    blacklisted: false,
    daysOnNetwork: 90, // ≥ 60 cold-start floor
    rechargeCount30d: 25, // engagementMult well above 0.75
    loansTaken180d: 1,
    loansRecovered180d: 1,
    historicalCuredDefaults180d: 0,
    historicalCuredDefaultsLifetime: 0,
    uncuredDefaultExists: false,
    ourOutstandingKobo: 0,
    ourDisbursed24hNaira: 0,
    eligibilityChecks1h: 0,
  };

  it('first post-cold-start loan with clean repayment receives the full bonus', () => {
    const result = scoreV3({
      features: cleanFirstLoanFeatures,
      request: { daKobo: 0, loanType: 'AIRTIME' },
      systemExposurePct: 0,
    });
    expect(result.components.continuityBonusNaira).toBe(100);
    expect(result.finalLimitNaira).toBeGreaterThanOrEqual(100);
  });

  it('bonus decays linearly across the window', () => {
    const taken3 = scoreV3({
      features: { ...cleanFirstLoanFeatures, loansTaken180d: 3, loansRecovered180d: 3 },
      request: { daKobo: 0, loanType: 'AIRTIME' },
      systemExposurePct: 0,
    });
    // taken=3 in window=3 → bonus * (1 - 2/3) ≈ 33.3
    expect(taken3.components.continuityBonusNaira).toBeCloseTo(100 / 3, 5);
  });

  it('zero bonus once outside the loan window', () => {
    const taken4 = scoreV3({
      features: { ...cleanFirstLoanFeatures, loansTaken180d: 4, loansRecovered180d: 4 },
      request: { daKobo: 0, loanType: 'AIRTIME' },
      systemExposurePct: 0,
    });
    expect(taken4.components.continuityBonusNaira).toBe(0);
  });

  it('zero bonus when repayment record is imperfect (recovered < taken)', () => {
    const result = scoreV3({
      features: { ...cleanFirstLoanFeatures, loansTaken180d: 2, loansRecovered180d: 1 },
      request: { daKobo: 0, loanType: 'AIRTIME' },
      systemExposurePct: 0,
    });
    expect(result.components.continuityBonusNaira).toBe(0);
  });

  it('zero bonus for cold-start subscriber with taken=0 (use cold-start path instead)', () => {
    const result = scoreV3({
      features: { ...cleanFirstLoanFeatures, loansTaken180d: 0, loansRecovered180d: 0 },
      request: { daKobo: 0, loanType: 'AIRTIME' },
      systemExposurePct: 0,
    });
    expect(result.components.continuityBonusNaira).toBe(0);
    expect(result.components.coldStartUsed).toBe(true);
  });

  it('zero bonus when subscriber is below cold-start tenure floor', () => {
    const result = scoreV3({
      features: { ...cleanFirstLoanFeatures, daysOnNetwork: 30 },
      request: { daKobo: 0, loanType: 'AIRTIME' },
      systemExposurePct: 0,
    });
    expect(result.components.continuityBonusNaira).toBe(0);
  });

  it('bonus is gated by engagement floor (clean repayer with low recharges → no bonus)', () => {
    // Very low recharge → engagementMult below 0.75 cold-start floor →
    // continuity gate fails. Subscriber gets the un-bonused base limit
    // (which may be 0 if score is sub-threshold).
    const result = scoreV3({
      features: {
        ...cleanFirstLoanFeatures,
        rechargeCount30d: 1,
      },
      request: { daKobo: 0, loanType: 'AIRTIME' },
      systemExposurePct: 0,
    });
    expect(result.components.continuityBonusNaira).toBe(0);
  });

  it('Tunde at 1/1 AIRTIME — with continuity bonus, the cliff is smoothed', () => {
    // Same shape as the existing "Tunde DENIED" worked example
    // (taken=1/recovered=1 thin-file post-cold-start) but shows that
    // when continuity-bonus gates pass, the customer receives a non-
    // zero limit equal to the bonus (stage-3 base is still 0 because
    // the score is below threshold).
    const result = scoreV3({
      features: cleanFirstLoanFeatures,
      request: { daKobo: 0, loanType: 'AIRTIME' },
      systemExposurePct: 0,
    });
    expect(result.baseLimitNaira).toBe(0); // score still below threshold
    expect(result.components.continuityBonusNaira).toBe(100);
    // Stage 4 clamps will still apply (partner cap, daily cap,
    // exposure taper) — at zero exposure / no DA / no prior 24h, the
    // bonus survives intact.
    expect(result.finalLimitNaira).toBe(100);
  });
});

describe('heuristic_v3 — Stage 4 exposure taper', () => {
  for (const v of STAGE4_CLAMP_VECTORS) {
    it(v.name, () => {
      // Synthesize a feature row whose Stage 3 base limit is ≥ baseLimit (so
      // partner/daily clamps don't fire), then check the taper alone.
      const result = scoreV3({
        features: {
          msisdn: '2340000000000',
          blacklisted: false,
          daysOnNetwork: 730,
          rechargeCount30d: 30,
          loansTaken180d: 50,
          loansRecovered180d: 50,
          historicalCuredDefaults180d: 0,
          historicalCuredDefaultsLifetime: 0,
          uncuredDefaultExists: false,
          ourOutstandingKobo: 0,
          ourDisbursed24hNaira: 0,
          eligibilityChecks1h: 0,
        },
        request: { daKobo: 0, loanType: 'DATA' },
        systemExposurePct: v.exposurePct,
      });
      // Use the actual stage-3 limit as the baseline for the taper assertion;
      // the vector is qualitative (full → 50 % → halt → halt).
      const expected = (() => {
        if (v.exposurePct >= 0.95) return 0;
        if (v.exposurePct >= 0.85) {
          const taper = 1 - (v.exposurePct - 0.85) / 0.1;
          return Math.floor(result.baseLimitNaira * taper);
        }
        return result.baseLimitNaira;
      })();
      expect(result.finalLimitNaira).toBe(expected);
    });
  }
});

describe('heuristic_v3 — Stage 1 hard gates', () => {
  const baseFeatures = {
    msisdn: '2340000000000',
    blacklisted: false,
    daysOnNetwork: 730,
    rechargeCount30d: 12,
    loansTaken180d: 5,
    loansRecovered180d: 5,
    historicalCuredDefaults180d: 0,
    historicalCuredDefaultsLifetime: 0,
    uncuredDefaultExists: false,
    ourOutstandingKobo: 0,
    ourDisbursed24hNaira: 0,
    eligibilityChecks1h: 0,
  };

  it('BLACKLIST short-circuits before any compute', () => {
    const r = scoreV3({
      features: { ...baseFeatures, blacklisted: true },
      request: { daKobo: 0, loanType: 'AIRTIME' },
      systemExposurePct: 0,
    });
    expect(r.gateFailed).toBe('BLACKLIST');
    expect(r.finalLimitNaira).toBe(0);
  });

  it('OUTSTANDING gate fires when ourOutstandingKobo > 0', () => {
    const r = scoreV3({
      features: { ...baseFeatures, ourOutstandingKobo: 1 },
      request: { daKobo: 0, loanType: 'AIRTIME' },
      systemExposurePct: 0,
    });
    expect(r.gateFailed).toBe('OUTSTANDING');
  });

  it('DA_CAP gate fires at partner cap', () => {
    const r = scoreV3({
      features: baseFeatures,
      request: { daKobo: 500_000, loanType: 'AIRTIME' }, // ₦5000 in kobo
      systemExposurePct: 0,
    });
    expect(r.gateFailed).toBe('DA_CAP');
  });

  it('VELOCITY gate fires at the extreme threshold', () => {
    const r = scoreV3({
      features: { ...baseFeatures, eligibilityChecks1h: 10 },
      request: { daKobo: 0, loanType: 'AIRTIME' },
      systemExposurePct: 0,
    });
    expect(r.gateFailed).toBe('VELOCITY');
  });

  it('TYPE_DISABLED gate fires when product kill switch is off', () => {
    const r = scoreV3({
      features: baseFeatures,
      request: { daKobo: 0, loanType: 'TALKTIME' },
      systemExposurePct: 0,
      config: {
        ...DEFAULT_CSDP_CONFIG,
        loanTypeEnabled: { AIRTIME: true, DATA: true, TALKTIME: false },
      },
    });
    expect(r.gateFailed).toBe('TYPE_DISABLED');
  });
});
