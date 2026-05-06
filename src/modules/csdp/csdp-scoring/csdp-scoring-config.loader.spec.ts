import {
  CsdpScoringConfigLoader,
  CONFIG_CACHE_TTL_MS,
  CONFIG_CACHE_HARD_TTL_MS,
} from './csdp-scoring-config.loader';
import { DEFAULT_CSDP_CONFIG } from './heuristic-v3';

function makeSystemConfig(rows: Array<{ key: string; value: unknown }>) {
  return {
    findAll: jest.fn(async () => rows),
  } as never;
}

function makeMetrics() {
  return {
    cacheHits: { inc: jest.fn() } as never,
    cacheTtlExceeded: { inc: jest.fn() } as never,
    cacheStaleSeconds: { set: jest.fn() } as never,
  };
}

function makeLoader(rows: Array<{ key: string; value: unknown }>) {
  const m = makeMetrics();
  const sys = makeSystemConfig(rows);
  const loader = new CsdpScoringConfigLoader(
    sys,
    m.cacheHits,
    m.cacheTtlExceeded,
    m.cacheStaleSeconds,
  );
  return { loader, sys, ...m };
}

const SEED_ROWS: Array<[string, unknown]> = [
  ['csdp.score.prior_alpha', 2],
  ['csdp.score.prior_beta', 2],
  ['csdp.score.confidence_pseudo_n', 4],
  ['csdp.score.evidence_max', 800],
  ['csdp.score.tenure_mult_min', 0.85],
  ['csdp.score.tenure_sat_days', 365],
  ['csdp.score.engagement_mult_min', 0.7],
  ['csdp.score.engagement_sat', 20],
  ['csdp.score.cold_start_base', 200],
  ['csdp.score.cold_start_min_tenure_days', 60],
  ['csdp.score.cold_start_min_engagement', 0.75],
  ['csdp.score.penalty_cured_recent', 100],
  ['csdp.score.penalty_cured_lifetime', 30],
  ['csdp.score.penalty_cured_lifetime_cap', 150],
  ['csdp.score.penalty_velocity', 5],
  ['csdp.score.velocity_threshold', 3],
  ['csdp.tier.base_threshold', 300],
  ['csdp.tier.thin_file_max_bonus', 220],
  ['csdp.tier.thin_file_saturation', 6],
  ['csdp.tier.curve_exponent', 0.85],
  ['csdp.tier.anchors.AIRTIME.small_min', 50],
  ['csdp.tier.anchors.AIRTIME.max_limit', 1500],
  ['csdp.tier.anchors.DATA.small_min', 100],
  ['csdp.tier.anchors.DATA.max_limit', 3000],
  ['csdp.tier.anchors.TALKTIME.small_min', 50],
  ['csdp.tier.anchors.TALKTIME.max_limit', 1000],
  ['csdp.partner_cap_naira', 5000],
  ['csdp.daily_user_cap_naira.AIRTIME', 1500],
  ['csdp.daily_user_cap_naira.DATA', 3000],
  ['csdp.daily_user_cap_naira.TALKTIME', 1000],
  ['csdp.exposure.taper_start_pct', 0.85],
  ['csdp.exposure.halt_pct', 0.95],
  ['csdp.gate.velocity_extreme', 10],
  ['csdp.loan_type_enabled.AIRTIME', true],
  ['csdp.loan_type_enabled.DATA', true],
  ['csdp.loan_type_enabled.TALKTIME', true],
];

describe('CsdpScoringConfigLoader.load', () => {
  it('full seed maps exactly to DEFAULT_CSDP_CONFIG', async () => {
    const { loader } = makeLoader(SEED_ROWS.map(([key, value]) => ({ key, value })));
    expect(await loader.load()).toEqual(DEFAULT_CSDP_CONFIG);
  });

  it('queries SYSTEM_CONFIG with category=csdp_scoring', async () => {
    const { loader, sys } = makeLoader([]);
    await loader.load();
    expect((sys as { findAll: jest.Mock }).findAll).toHaveBeenCalledWith({
      category: 'csdp_scoring',
    });
  });

  it('missing keys fall back to DEFAULT_CSDP_CONFIG', async () => {
    const { loader } = makeLoader([]);
    expect(await loader.load()).toEqual(DEFAULT_CSDP_CONFIG);
  });

  it('overridden numeric value takes effect', async () => {
    const { loader } = makeLoader([
      ...SEED_ROWS.map(([key, value]) => ({ key, value })),
      { key: 'csdp.partner_cap_naira', value: 9999 },
    ]);
    expect((await loader.load()).partnerCapNaira).toBe(9999);
  });

  it('overridden boolean kill switch takes effect', async () => {
    const { loader } = makeLoader([
      ...SEED_ROWS.map(([key, value]) => ({ key, value })),
      { key: 'csdp.loan_type_enabled.DATA', value: false },
    ]);
    expect((await loader.load()).loanTypeEnabled.DATA).toBe(false);
  });

  it('parses string-typed boolean ("true"/"false") for compatibility', async () => {
    const { loader } = makeLoader([
      { key: 'csdp.loan_type_enabled.AIRTIME', value: 'false' },
    ]);
    expect((await loader.load()).loanTypeEnabled.AIRTIME).toBe(false);
  });

  it('non-numeric junk in a numeric key falls back to default', async () => {
    const { loader } = makeLoader([{ key: 'csdp.score.evidence_max', value: 'oops' }]);
    expect((await loader.load()).evidenceMax).toBe(DEFAULT_CSDP_CONFIG.evidenceMax);
  });

  it('composes anchors and dailyUserCapNaira independently per loan type', async () => {
    const { loader } = makeLoader([
      { key: 'csdp.tier.anchors.DATA.max_limit', value: 4000 },
      { key: 'csdp.daily_user_cap_naira.AIRTIME', value: 2500 },
    ]);
    const cfg = await loader.load();
    expect(cfg.anchors.DATA.maxLimit).toBe(4000);
    expect(cfg.anchors.DATA.smallMin).toBe(DEFAULT_CSDP_CONFIG.anchors.DATA.smallMin);
    expect(cfg.dailyUserCapNaira.AIRTIME).toBe(2500);
    expect(cfg.dailyUserCapNaira.DATA).toBe(DEFAULT_CSDP_CONFIG.dailyUserCapNaira.DATA);
  });
});

describe('CsdpScoringConfigLoader cache + degraded-behavior fallback', () => {
  it('serves the cached snapshot within the TTL window without hitting SYSTEM_CONFIG twice', async () => {
    const { loader, sys, cacheHits } = makeLoader([
      { key: 'csdp.partner_cap_naira', value: 1234 },
    ]);
    await loader.load();
    await loader.load();
    expect((sys as { findAll: jest.Mock }).findAll).toHaveBeenCalledTimes(1);
    const calls = (cacheHits as { inc: jest.Mock }).inc.mock.calls.map((c) => c[0]?.result);
    expect(calls).toContain('hit');
  });

  it('coalesces concurrent refreshes into a single SYSTEM_CONFIG read', async () => {
    const { loader, sys } = makeLoader([]);
    await Promise.all([loader.load(), loader.load(), loader.load()]);
    expect((sys as { findAll: jest.Mock }).findAll).toHaveBeenCalledTimes(1);
  });

  it('refreshes from SYSTEM_CONFIG once the TTL window has elapsed', async () => {
    const { loader, sys } = makeLoader([{ key: 'csdp.partner_cap_naira', value: 100 }]);
    await loader.load();
    // Move the clock past TTL.
    jest.spyOn(Date, 'now').mockReturnValue(Date.now() + CONFIG_CACHE_TTL_MS + 1);
    await loader.load();
    expect((sys as { findAll: jest.Mock }).findAll).toHaveBeenCalledTimes(2);
    (Date.now as jest.Mock).mockRestore?.();
  });

  it('serves stale snapshot when SYSTEM_CONFIG read fails inside hard TTL', async () => {
    const m = makeMetrics();
    const sys = {
      findAll: jest
        .fn()
        .mockResolvedValueOnce([{ key: 'csdp.partner_cap_naira', value: 7777 }])
        .mockRejectedValue(new Error('db down')),
    } as never;
    const loader = new CsdpScoringConfigLoader(
      sys,
      m.cacheHits,
      m.cacheTtlExceeded,
      m.cacheStaleSeconds,
    );
    const first = await loader.load();
    expect(first.partnerCapNaira).toBe(7777);

    // Move past TTL but inside hard TTL.
    jest.spyOn(Date, 'now').mockReturnValue(Date.now() + CONFIG_CACHE_TTL_MS + 1000);
    const second = await loader.load();
    expect(second.partnerCapNaira).toBe(7777);
    expect((m.cacheTtlExceeded as { inc: jest.Mock }).inc).toHaveBeenCalledWith({
      outcome: 'stale',
    });
    expect((m.cacheStaleSeconds as { set: jest.Mock }).set).toHaveBeenCalled();
    (Date.now as jest.Mock).mockRestore?.();
  });

  it('falls back to DEFAULT_CSDP_CONFIG when stale exceeds hard TTL', async () => {
    const m = makeMetrics();
    const sys = {
      findAll: jest
        .fn()
        .mockResolvedValueOnce([{ key: 'csdp.partner_cap_naira', value: 7777 }])
        .mockRejectedValue(new Error('db still down')),
    } as never;
    const loader = new CsdpScoringConfigLoader(
      sys,
      m.cacheHits,
      m.cacheTtlExceeded,
      m.cacheStaleSeconds,
    );
    await loader.load();
    jest.spyOn(Date, 'now').mockReturnValue(Date.now() + CONFIG_CACHE_HARD_TTL_MS + 1000);
    const result = await loader.load();
    expect(result).toEqual(DEFAULT_CSDP_CONFIG);
    expect((m.cacheTtlExceeded as { inc: jest.Mock }).inc).toHaveBeenCalledWith({
      outcome: 'defaults',
    });
    (Date.now as jest.Mock).mockRestore?.();
  });

  it('returns DEFAULT_CSDP_CONFIG on first-call failure (no cached snapshot yet)', async () => {
    const m = makeMetrics();
    const sys = {
      findAll: jest.fn().mockRejectedValue(new Error('db cold')),
    } as never;
    const loader = new CsdpScoringConfigLoader(
      sys,
      m.cacheHits,
      m.cacheTtlExceeded,
      m.cacheStaleSeconds,
    );
    const result = await loader.load();
    expect(result).toEqual(DEFAULT_CSDP_CONFIG);
    expect((m.cacheTtlExceeded as { inc: jest.Mock }).inc).toHaveBeenCalledWith({
      outcome: 'defaults',
    });
  });
});
