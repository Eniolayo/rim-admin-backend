import { EligibilityLoggerService } from './eligibility-logger.service';
import { DecisionContext, DecisionResult } from './decision-router.service';
import {
  CsdpScoreResult,
  DEFAULT_CSDP_CONFIG,
  scoreV3,
} from '../csdp-scoring/heuristic-v3';

function makeQueue() {
  const adds: Array<{ name: string; payload: unknown }> = [];
  return {
    queue: {
      add: jest.fn(async (name: string, payload: unknown) => {
        adds.push({ name, payload });
        return { id: 'job-1' };
      }),
    },
    adds,
  };
}

const ctx: DecisionContext = {
  msisdn: '2348012345678',
  transRef: 'TX-1',
  daKoboRaw: '5000',
  daNaira: '50.00',
  loanType: 'AIRTIME',
  receivedAt: Date.now() - 10,
};

const legacyResult: DecisionResult = {
  responseLimitNaira: '0',
  teamweeLimitNaira: null,
  rimLimitNaira: null,
  winner: 'STUB',
  decisionMode: 'STUB_DENY',
  teamweeLatencyMs: null,
  rimLatencyMs: null,
  totalLatencyMs: 5,
  errorReason: null,
};

function realScoreResult(): CsdpScoreResult {
  return scoreV3({
    features: {
      msisdn: '2348012345678',
      blacklisted: false,
      daysOnNetwork: 730,
      rechargeCount30d: 12,
      loansTaken180d: 12,
      loansRecovered180d: 12,
      historicalCuredDefaults180d: 0,
      historicalCuredDefaultsLifetime: 0,
      uncuredDefaultExists: false,
      ourOutstandingKobo: 0,
      ourDisbursed24hNaira: 0,
      eligibilityChecks1h: 1,
    },
    request: { daKobo: 80000, loanType: 'DATA' },
    systemExposurePct: 0.4,
    config: DEFAULT_CSDP_CONFIG,
  });
}

describe('EligibilityLoggerService.enqueue', () => {
  it('legacy path: scoring fields are null, decision_mode from result', async () => {
    const { queue, adds } = makeQueue();
    const svc = new EligibilityLoggerService(queue as never);

    await svc.enqueue(ctx, legacyResult);

    expect(adds).toHaveLength(1);
    const p = adds[0].payload as Record<string, unknown>;
    expect(p.decision_mode).toBe('STUB_DENY');
    expect(p.score).toBeNull();
    expect(p.score_components).toBeNull();
    expect(p.final_limit_naira).toBeNull();
    expect(p.gate_failed).toBeNull();
    expect(p.model_version).toBeNull();
  });

  it('SHADOW path: scoring fields populated, decision_mode overridden', async () => {
    const { queue, adds } = makeQueue();
    const svc = new EligibilityLoggerService(queue as never);
    const scoring = realScoreResult();

    await svc.enqueue(ctx, legacyResult, scoring, 'SHADOW');

    const p = adds[0].payload as Record<string, unknown>;
    expect(p.decision_mode).toBe('SHADOW');
    expect(p.score).toBe(scoring.score);
    expect(p.final_limit_naira).toBe(scoring.finalLimitNaira);
    expect(p.base_limit_naira).toBe(scoring.baseLimitNaira);
    expect(p.partner_residual_naira).toBe(scoring.partnerResidualNaira);
    expect(p.daily_user_remaining_naira).toBe(scoring.dailyUserRemainingNaira);
    expect(p.system_exposure_pct).toBe(scoring.systemExposurePct);
    expect(p.model_version).toBe('heuristic_v3');
    expect(p.gate_failed).toBe(scoring.gateFailed);
    expect(p.score_components).toEqual(scoring.components);
    // rim_limit_naira mirrors final_limit_naira so existing dashboards
    // and idempotency lookups see the heuristic_v3 number.
    expect(p.rim_limit_naira).toBe(scoring.finalLimitNaira.toString());
  });

  it('does not throw when queue.add fails', async () => {
    const queue = {
      add: jest.fn(async () => {
        throw new Error('redis down');
      }),
    };
    const svc = new EligibilityLoggerService(queue as never);

    await expect(svc.enqueue(ctx, legacyResult)).resolves.toBeUndefined();
  });
});
