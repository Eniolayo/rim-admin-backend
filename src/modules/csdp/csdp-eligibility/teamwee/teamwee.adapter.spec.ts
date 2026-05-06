/**
 * TeamweeAdapter unit tests.
 * nock is not installed; we mock global fetch via jest.spyOn instead.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getToken } from '@willsoto/nestjs-prometheus';
import { TeamweeAdapter } from './teamwee.adapter';
import { TeamweeUnavailableError } from './teamwee.errors';
import { CSDP_METRICS } from '../../csdp-core/metrics/csdp-metrics.module';
import type { TeamweeEligibilityRequest } from './teamwee.types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeResponse(
  status: number,
  body: unknown,
): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

const baseRequest: TeamweeEligibilityRequest = {
  msisdn: '2348012345678',
  transRef: 'ref-001',
  daKobo: '1000',
  loanType: 'AIRTIME',
};

// ---------------------------------------------------------------------------
// Module factory
// ---------------------------------------------------------------------------

async function buildModule(
  configOverrides: Record<string, unknown> = {},
): Promise<TeamweeAdapter> {
  const defaults: Record<string, unknown> = {
    TEAMWEE_BASE_URL: 'https://api.teamwee.example',
    TEAMWEE_API_KEY: 'test-key',
    TEAMWEE_TIMEOUT_MS: 800,
    TEAMWEE_CB_THRESHOLD: 5,
    TEAMWEE_CB_RESET_MS: 30000,
  };
  const cfg = { ...defaults, ...configOverrides };

  const mockHistogram = { observe: jest.fn() };
  const metricToken = getToken(CSDP_METRICS.teamweeLatencyMs);

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      TeamweeAdapter,
      {
        provide: ConfigService,
        useValue: {
          get: jest.fn((key: string) => cfg[key]),
        },
      },
      {
        provide: metricToken,
        useValue: mockHistogram,
      },
    ],
  }).compile();

  return module.get(TeamweeAdapter);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TeamweeAdapter', () => {
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ---- Happy path ----------------------------------------------------------

  it('returns limitNaira from Teamwee response and circuit stays CLOSED', async () => {
    fetchSpy.mockResolvedValueOnce(
      makeResponse(200, { limit_naira: '50.00' }),
    );

    const adapter = await buildModule();
    const result = await adapter.checkEligibility(baseRequest);

    expect(result.limitNaira).toBe('50.00');
    expect(result.rawResponse).toEqual({ limit_naira: '50.00' });
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    const [calledUrl, calledInit] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toContain('/eligibility?');
    expect(calledUrl).toContain('msisdn=2348012345678');
    expect(calledUrl).toContain('transRef=ref-001');
    expect(calledUrl).toContain('loanType=AIRTIME');
    expect(calledUrl).toContain('da=1000');
    expect(calledInit.method).toBe('GET');
    expect(calledInit.body).toBeUndefined();
    // Circuit should still be CLOSED — subsequent call must reach fetch
    fetchSpy.mockResolvedValueOnce(makeResponse(200, { limit_naira: '0.00' }));
    const r2 = await adapter.checkEligibility(baseRequest);
    expect(r2.limitNaira).toBe('0.00');
  });

  // ---- Missing config ------------------------------------------------------

  it('throws TeamweeUnavailableError(connection) when TEAMWEE_BASE_URL is missing', async () => {
    const adapter = await buildModule({ TEAMWEE_BASE_URL: undefined });
    await expect(adapter.checkEligibility(baseRequest)).rejects.toMatchObject({
      cause: 'connection',
      name: 'TeamweeUnavailableError',
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  // ---- Timeout -------------------------------------------------------------

  it('throws TeamweeUnavailableError(timeout) when fetch rejects with AbortError', async () => {
    const abortError = Object.assign(new Error('The operation was aborted'), {
      name: 'AbortError',
    });
    fetchSpy.mockRejectedValueOnce(abortError);

    const adapter = await buildModule();
    await expect(adapter.checkEligibility(baseRequest)).rejects.toMatchObject({
      cause: 'timeout',
    });
  });

  // ---- 5xx ----------------------------------------------------------------

  it('throws TeamweeUnavailableError(http_5xx) on 503 response', async () => {
    fetchSpy.mockResolvedValueOnce(makeResponse(503, {}));

    const adapter = await buildModule();
    await expect(adapter.checkEligibility(baseRequest)).rejects.toMatchObject({
      cause: 'http_5xx',
    });
  });

  // ---- Malformed body -----------------------------------------------------

  it('throws TeamweeUnavailableError(malformed) when limit_naira is missing', async () => {
    fetchSpy.mockResolvedValueOnce(makeResponse(200, { something_else: 1 }));

    const adapter = await buildModule();
    await expect(adapter.checkEligibility(baseRequest)).rejects.toMatchObject({
      cause: 'malformed',
    });
  });

  it('throws TeamweeUnavailableError(malformed) when limit_naira is non-numeric', async () => {
    fetchSpy.mockResolvedValueOnce(
      makeResponse(200, { limit_naira: 'not-a-number' }),
    );

    const adapter = await buildModule();
    await expect(adapter.checkEligibility(baseRequest)).rejects.toMatchObject({
      cause: 'malformed',
    });
  });

  // ---- Connection error retries -------------------------------------------

  it('retries once on connection error and succeeds on second attempt', async () => {
    const connError = new Error('ECONNREFUSED');
    fetchSpy
      .mockRejectedValueOnce(connError) // first attempt fails
      .mockResolvedValueOnce(makeResponse(200, { limit_naira: '2.00' })); // retry succeeds

    const adapter = await buildModule();
    const result = await adapter.checkEligibility(baseRequest);

    expect(result.limitNaira).toBe('2.00');
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  // ---- Circuit breaker opens ----------------------------------------------

  it('opens circuit after threshold failures and 6th call throws circuit_open without invoking fetch', async () => {
    // threshold = 5 in default config
    const adapter = await buildModule({ TEAMWEE_CB_THRESHOLD: 5 });

    // Cause 5 failures (503s)
    for (let i = 0; i < 5; i++) {
      fetchSpy.mockResolvedValueOnce(makeResponse(503, {}));
      await expect(adapter.checkEligibility(baseRequest)).rejects.toMatchObject(
        { cause: 'http_5xx' },
      );
    }

    // 6th call — circuit is OPEN, fetch must NOT be called
    const callCountBefore = fetchSpy.mock.calls.length;
    await expect(adapter.checkEligibility(baseRequest)).rejects.toMatchObject({
      cause: 'circuit_open',
    });
    expect(fetchSpy.mock.calls.length).toBe(callCountBefore);
  });
});
