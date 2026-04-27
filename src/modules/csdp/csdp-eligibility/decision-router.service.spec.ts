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
  daKobo: BigInt(5000),
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
    it('returns responseLimit="0", winner="STUB", does NOT call Teamwee', async () => {
      flags.get.mockResolvedValueOnce('STUB_DENY');

      const result = await service.decide(makeCtx());

      expect(result.responseLimit).toBe('0');
      expect(result.winner).toBe('STUB');
      expect(result.teamweeLimitKobo).toBeNull();
      expect(result.rimLimitKobo).toBeNull();
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
        limitKobo: BigInt(120000),
        latencyMs: 42,
        rawResponse: { limit_kobo: 120000 },
      });

      const result = await service.decide(makeCtx());

      expect(result.winner).toBe('TEAMWEE');
      expect(result.teamweeLimitKobo).toBe(BigInt(120000));
      expect(result.teamweeLatencyMs).toBe(42);
      expect(result.responseLimit).toBe('120000');
      expect(result.rimLimitKobo).toBeNull();
      expect(result.errorReason).toBeNull();
    });
  });

  describe('PROXY mode — circuit-breaker / Teamwee unavailable', () => {
    it('returns responseLimit="0" and winner=FALLBACK when Teamwee throws TeamweeUnavailableError', async () => {
      flags.get.mockResolvedValueOnce('PROXY');
      teamwee.checkEligibility.mockRejectedValueOnce(
        new TeamweeUnavailableError('circuit_open'),
      );

      const result = await service.decide(makeCtx());

      expect(result.responseLimit).toBe('0');
      expect(result.winner).toBe('FALLBACK');
      expect(result.errorReason).toBe('circuit_open');
      expect(result.teamweeLimitKobo).toBeNull();
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
});
