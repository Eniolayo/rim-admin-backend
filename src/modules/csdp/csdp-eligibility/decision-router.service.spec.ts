import { Test, TestingModule } from '@nestjs/testing';
import { DecisionRouterService, DecisionContext } from './decision-router.service';
import {
  CsdpFeatureFlagsService,
  FLAG_DECISION_MODE,
} from '../csdp-feature-flags/csdp-feature-flags.service';
import { TeamweeAdapter } from './teamwee/teamwee.adapter';
import { TeamweeUnavailableError } from './teamwee/teamwee.errors';
import { CSDP_METRICS } from '../csdp-core/metrics/csdp-metrics.module';
import { getToken } from '@willsoto/nestjs-prometheus';

const makeCtx = (overrides?: Partial<DecisionContext>): DecisionContext => ({
  msisdn: '2348012345678',
  transRef: 'TXN-001',
  daKoboRaw: '5000',
  daNaira: '50.00',
  loanType: 'AIRTIME',
  receivedAt: Date.now() - 10,
  ...overrides,
});

describe('DecisionRouterService', () => {
  let service: DecisionRouterService;
  let flags: jest.Mocked<CsdpFeatureFlagsService>;
  let teamwee: jest.Mocked<TeamweeAdapter>;
  let counter: { inc: jest.Mock };
  let histogram: { observe: jest.Mock };

  beforeEach(async () => {
    flags = { get: jest.fn() } as unknown as jest.Mocked<CsdpFeatureFlagsService>;
    teamwee = { checkEligibility: jest.fn() } as unknown as jest.Mocked<TeamweeAdapter>;
    counter = { inc: jest.fn() };
    histogram = { observe: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DecisionRouterService,
        { provide: CsdpFeatureFlagsService, useValue: flags },
        { provide: TeamweeAdapter, useValue: teamwee },
        { provide: getToken(CSDP_METRICS.profileRequestsTotal), useValue: counter },
        { provide: getToken(CSDP_METRICS.profileLatencyMs), useValue: histogram },
      ],
    }).compile();

    service = module.get<DecisionRouterService>(DecisionRouterService);
  });

  describe('STUB_DENY mode', () => {
    it('returns responseLimitNaira="0", winner="STUB", does NOT call Teamwee', async () => {
      flags.get.mockResolvedValueOnce('STUB_DENY');

      const result = await service.decide(makeCtx());

      expect(result.responseLimitNaira).toBe('0');
      expect(result.winner).toBe('STUB');
      expect(result.teamweeLimitNaira).toBeNull();
      expect(result.rimLimitNaira).toBeNull();
      expect(result.errorReason).toBeNull();
      expect(teamwee.checkEligibility).not.toHaveBeenCalled();
      expect(result.totalLatencyMs).toBeGreaterThanOrEqual(0);
    });

    it('defaults to STUB_DENY when flag is undefined', async () => {
      flags.get.mockResolvedValueOnce(undefined);

      const result = await service.decide(makeCtx());

      expect(result.winner).toBe('STUB');
      expect(teamwee.checkEligibility).not.toHaveBeenCalled();
    });

    it('increments counter with correct labels', async () => {
      flags.get.mockResolvedValueOnce('STUB_DENY');

      await service.decide(makeCtx({ loanType: 'DATA' }));

      expect(counter.inc).toHaveBeenCalledWith({
        winner: 'STUB',
        loan_type: 'DATA',
        decision_mode: 'STUB_DENY',
      });
    });
  });

  describe('PROXY mode — Teamwee success', () => {
    it('returns Teamwee limit and winner=TEAMWEE', async () => {
      flags.get.mockResolvedValueOnce('PROXY');
      teamwee.checkEligibility.mockResolvedValueOnce({
        limitNaira: '1200.00',
        latencyMs: 42,
        rawResponse: { limit_kobo: 120000 },
      });

      const result = await service.decide(makeCtx());

      expect(result.winner).toBe('TEAMWEE');
      expect(result.teamweeLimitNaira).toBe('1200.00');
      expect(result.teamweeLatencyMs).toBe(42);
      expect(result.responseLimitNaira).toBe('1200.00');
      expect(result.rimLimitNaira).toBeNull();
      expect(result.errorReason).toBeNull();
    });
  });

  describe('PROXY mode — circuit-breaker / Teamwee unavailable', () => {
    it('returns responseLimitNaira="0" and winner=FALLBACK when Teamwee throws TeamweeUnavailableError', async () => {
      flags.get.mockResolvedValueOnce('PROXY');
      teamwee.checkEligibility.mockRejectedValueOnce(
        new TeamweeUnavailableError('circuit_open'),
      );

      const result = await service.decide(makeCtx());

      expect(result.responseLimitNaira).toBe('0');
      expect(result.winner).toBe('FALLBACK');
      expect(result.errorReason).toBe('circuit_open');
      expect(result.teamweeLimitNaira).toBeNull();
    });

    it('handles TeamweeUnavailableError with timeout cause', async () => {
      flags.get.mockResolvedValueOnce('PROXY');
      teamwee.checkEligibility.mockRejectedValueOnce(
        new TeamweeUnavailableError('timeout'),
      );

      const result = await service.decide(makeCtx());

      expect(result.winner).toBe('FALLBACK');
      expect(result.errorReason).toBe('timeout');
    });
  });

  describe('PROXY mode — malformed response', () => {
    it('returns FALLBACK when Teamwee throws non-TeamweeUnavailableError (unexpected)', async () => {
      flags.get.mockResolvedValueOnce('PROXY');
      teamwee.checkEligibility.mockRejectedValueOnce(new Error('unexpected'));

      const result = await service.decide(makeCtx());

      expect(result.winner).toBe('FALLBACK');
      expect(result.errorReason).toContain('unexpected');
    });
  });

  describe('resolveMode', () => {
    it('returns STUB_DENY when flag is unset', async () => {
      flags.get.mockResolvedValueOnce(undefined);
      await expect(service.resolveMode()).resolves.toBe('STUB_DENY');
    });

    it('returns STUB_DENY for malformed flag value', async () => {
      flags.get.mockResolvedValueOnce('LIVE_99' as unknown);
      await expect(service.resolveMode()).resolves.toBe('STUB_DENY');
    });

    it('returns the configured mode when valid', async () => {
      flags.get.mockResolvedValueOnce('LIVE_50');
      await expect(service.resolveMode()).resolves.toBe('LIVE_50');
    });
  });

  describe('selectFinal', () => {
    const legacy = (overrides = {}) => ({
      responseLimitNaira: '500',
      teamweeLimitNaira: '500',
      rimLimitNaira: null,
      winner: 'TEAMWEE' as const,
      decisionMode: 'SHADOW' as const,
      teamweeLatencyMs: 12,
      rimLatencyMs: null,
      totalLatencyMs: 18,
      errorReason: null,
      ...overrides,
    });

    const scoring = (finalNaira: number) => ({
      result: {
        finalLimitNaira: finalNaira,
        score: 0.6,
        gateFailed: null,
      },
      features: {},
      systemExposurePct: 0.1,
    }) as unknown as import('../csdp-scoring/csdp-scoring.service').ScoreOutput;

    it('SHADOW returns legacy unchanged', () => {
      const r = service.selectFinal(makeCtx(), 'SHADOW', legacy(), scoring(1000));
      expect(r.responseLimitNaira).toBe('500');
      expect(r.winner).toBe('TEAMWEE');
      expect(r.decisionMode).toBe('SHADOW');
    });

    it('STUB_DENY returns legacy unchanged even when scoring is present', () => {
      const r = service.selectFinal(
        makeCtx(),
        'STUB_DENY',
        legacy({ responseLimitNaira: '0', winner: 'STUB', decisionMode: 'STUB_DENY' }),
        scoring(2000),
      );
      expect(r.responseLimitNaira).toBe('0');
      expect(r.decisionMode).toBe('STUB_DENY');
    });

    it('LIVE serves heuristic_v3 to all MSISDNs', () => {
      const r = service.selectFinal(makeCtx(), 'LIVE', legacy(), scoring(2000));
      expect(r.responseLimitNaira).toBe('2000');
      expect(r.winner).toBe('RIM');
      expect(r.decisionMode).toBe('LIVE');
      expect(r.rimLimitNaira).toBe('2000');
    });

    it('LIVE falls back to legacy when scoring is null and stamps errorReason', () => {
      const r = service.selectFinal(makeCtx(), 'LIVE', legacy(), null);
      expect(r.responseLimitNaira).toBe('500');
      expect(r.decisionMode).toBe('LIVE');
      expect(r.errorReason).toBe('scoring_unavailable');
    });

    it('LIVE_5 cohort selection is deterministic per MSISDN', () => {
      // Hash both MSISDNs and find one in-cohort, one out-of-cohort.
      const inMs = (() => {
        for (let i = 0; i < 1000; i++) {
          const m = `2348${String(i).padStart(9, '0')}`;
          const r = service.selectFinal(makeCtx({ msisdn: m }), 'LIVE_5', legacy(), scoring(2000));
          if (r.winner === 'RIM') return m;
        }
        throw new Error('no in-cohort msisdn found');
      })();

      const r1 = service.selectFinal(makeCtx({ msisdn: inMs }), 'LIVE_5', legacy(), scoring(2000));
      const r2 = service.selectFinal(makeCtx({ msisdn: inMs }), 'LIVE_5', legacy(), scoring(2000));
      expect(r1.winner).toBe('RIM');
      expect(r2.winner).toBe('RIM');
      expect(r1.decisionMode).toBe('LIVE_5');
    });

    it('LIVE_5 records served_mode=SHADOW for out-of-cohort MSISDN', () => {
      // Pick an MSISDN deterministically out-of-cohort at 5%.
      const outMs = (() => {
        for (let i = 0; i < 1000; i++) {
          const m = `2348${String(i).padStart(9, '0')}`;
          const r = service.selectFinal(makeCtx({ msisdn: m }), 'LIVE_5', legacy(), scoring(2000));
          if (r.winner !== 'RIM') return m;
        }
        throw new Error('no out-of-cohort msisdn found');
      })();

      const r = service.selectFinal(makeCtx({ msisdn: outMs }), 'LIVE_5', legacy(), scoring(2000));
      expect(r.winner).toBe('TEAMWEE');
      expect(r.responseLimitNaira).toBe('500');
      expect(r.decisionMode).toBe('SHADOW');
    });

    it('LIVE_5 cohort is a strict subset of LIVE_50 cohort (smooth ramp)', () => {
      let inFive = 0;
      let inFifty = 0;
      let inBoth = 0;
      for (let i = 0; i < 200; i++) {
        const m = `2348${String(i).padStart(9, '0')}`;
        const r5 = service.selectFinal(makeCtx({ msisdn: m }), 'LIVE_5', legacy(), scoring(2000));
        const r50 = service.selectFinal(makeCtx({ msisdn: m }), 'LIVE_50', legacy(), scoring(2000));
        const live5 = r5.winner === 'RIM';
        const live50 = r50.winner === 'RIM';
        if (live5) inFive++;
        if (live50) inFifty++;
        if (live5 && live50) inBoth++;
        if (live5) expect(live50).toBe(true); // every LIVE_5 MSISDN is also in LIVE_50
      }
      expect(inFive).toBe(inBoth);
      expect(inFifty).toBeGreaterThanOrEqual(inFive);
    });
  });
});
