import { CsdpLiveCountersService } from './csdp-live-counters.service';

function makeRedis(stubs: {
  zrangebyscore?: string[];
  get?: string | null;
} = {}) {
  const calls: Array<{ cmd: string; args: unknown[] }> = [];
  const client = {
    zadd: jest.fn(async (...args: unknown[]) => {
      calls.push({ cmd: 'zadd', args });
      return 1;
    }),
    expire: jest.fn(async (...args: unknown[]) => {
      calls.push({ cmd: 'expire', args });
      return 1;
    }),
    zremrangebyscore: jest.fn(async (...args: unknown[]) => {
      calls.push({ cmd: 'zremrangebyscore', args });
      return 0;
    }),
    zrangebyscore: jest.fn(async (...args: unknown[]) => {
      calls.push({ cmd: 'zrangebyscore', args });
      return stubs.zrangebyscore ?? [];
    }),
    incr: jest.fn(async (...args: unknown[]) => {
      calls.push({ cmd: 'incr', args });
      return 1;
    }),
    get: jest.fn(async (...args: unknown[]) => {
      calls.push({ cmd: 'get', args });
      return stubs.get ?? null;
    }),
    set: jest.fn(async (...args: unknown[]) => {
      calls.push({ cmd: 'set', args });
      return 'OK';
    }),
  } as never;
  return { client, calls };
}

describe('CsdpLiveCountersService.recordDisbursement', () => {
  it('ZADDs with member="<naira>|<loanId>" and score=atMs, then sets expire', async () => {
    const { client, calls } = makeRedis();
    const svc = new CsdpLiveCountersService(client);

    await svc.recordDisbursement('2348012345678', 'LN-1', '110', 1700000000000);

    expect(calls[0]).toEqual({
      cmd: 'zadd',
      args: ['disbursed24h:2348012345678', 1700000000000, '110|LN-1'],
    });
    expect(calls[1].cmd).toBe('expire');
    expect(calls[1].args[0]).toBe('disbursed24h:2348012345678');
  });
});

describe('CsdpLiveCountersService.sumDisbursed24hNaira', () => {
  it('prunes stale members, then sums naira parts of remaining members', async () => {
    const { client, calls } = makeRedis({
      zrangebyscore: ['100|LN-A', '50|LN-B', '25|LN-C'],
    });
    const svc = new CsdpLiveCountersService(client);
    const now = 1_700_000_000_000;

    const total = await svc.sumDisbursed24hNaira('2348012345678', now);

    expect(total).toBe(175);
    const prune = calls.find((c) => c.cmd === 'zremrangebyscore');
    expect(prune!.args).toEqual([
      'disbursed24h:2348012345678',
      '-inf',
      `(${now - 24 * 60 * 60 * 1000}`,
    ]);
    const range = calls.find((c) => c.cmd === 'zrangebyscore');
    expect(range!.args[0]).toBe('disbursed24h:2348012345678');
    expect(range!.args[1]).toBe(now - 24 * 60 * 60 * 1000);
  });

  it('returns 0 when no members in window', async () => {
    const { client } = makeRedis({ zrangebyscore: [] });
    const svc = new CsdpLiveCountersService(client);
    expect(await svc.sumDisbursed24hNaira('2348012345678', Date.now())).toBe(0);
  });

  it('skips malformed members (no delimiter)', async () => {
    const { client } = makeRedis({
      zrangebyscore: ['100|LN-A', 'garbage', '|orphan', '50|LN-B'],
    });
    const svc = new CsdpLiveCountersService(client);
    expect(await svc.sumDisbursed24hNaira('2348012345678', Date.now())).toBe(150);
  });
});

describe('CsdpLiveCountersService.incrEligibilityCheck', () => {
  it('sets TTL=3600 only on first INCR (incr returned 1)', async () => {
    const { client, calls } = makeRedis();
    const svc = new CsdpLiveCountersService(client);

    await svc.incrEligibilityCheck('2348012345678');

    expect(calls[0]).toEqual({ cmd: 'incr', args: ['elig1h:2348012345678'] });
    expect(calls[1].cmd).toBe('expire');
    expect(calls[1].args).toEqual(['elig1h:2348012345678', 3600]);
  });

  it('does not set TTL when incr returns > 1 (key already existed)', async () => {
    const { client, calls } = makeRedis();
    (
      client as unknown as { incr: jest.Mock }
    ).incr.mockResolvedValueOnce(2);
    const svc = new CsdpLiveCountersService(client);

    await svc.incrEligibilityCheck('2348012345678');

    expect(calls.some((c) => c.cmd === 'expire')).toBe(false);
  });
});

describe('CsdpLiveCountersService.getEligibilityChecks1h', () => {
  it('returns 0 when key missing', async () => {
    const { client } = makeRedis({ get: null });
    const svc = new CsdpLiveCountersService(client);
    expect(await svc.getEligibilityChecks1h('2348012345678')).toBe(0);
  });

  it('parses integer string', async () => {
    const { client } = makeRedis({ get: '7' });
    const svc = new CsdpLiveCountersService(client);
    expect(await svc.getEligibilityChecks1h('2348012345678')).toBe(7);
  });

  it('returns 0 on non-numeric value', async () => {
    const { client } = makeRedis({ get: 'not-a-number' });
    const svc = new CsdpLiveCountersService(client);
    expect(await svc.getEligibilityChecks1h('2348012345678')).toBe(0);
  });
});

describe('CsdpLiveCountersService.getSystemExposurePct', () => {
  it('returns 0 when key missing', async () => {
    const { client } = makeRedis({ get: null });
    const svc = new CsdpLiveCountersService(client);
    expect(await svc.getSystemExposurePct()).toBe(0);
  });

  it('parses float', async () => {
    const { client } = makeRedis({ get: '0.42' });
    const svc = new CsdpLiveCountersService(client);
    expect(await svc.getSystemExposurePct()).toBeCloseTo(0.42);
  });
});

describe('CsdpLiveCountersService.setSystemExposurePct', () => {
  it('SETs key with EX TTL (default 120s)', async () => {
    const { client, calls } = makeRedis();
    const svc = new CsdpLiveCountersService(client);

    await svc.setSystemExposurePct(0.42);

    expect(calls[0]).toEqual({
      cmd: 'set',
      args: ['system_exposure_pct', '0.42', 'EX', 120],
    });
  });

  it('clamps non-finite or negative values to 0', async () => {
    const { client, calls } = makeRedis();
    const svc = new CsdpLiveCountersService(client);

    await svc.setSystemExposurePct(NaN);
    expect(calls[0].args[1]).toBe('0');

    await svc.setSystemExposurePct(-0.1);
    expect(calls[1].args[1]).toBe('0');
  });

  it('respects custom ttlSec', async () => {
    const { client, calls } = makeRedis();
    const svc = new CsdpLiveCountersService(client);

    await svc.setSystemExposurePct(0.5, 60);
    expect(calls[0].args[3]).toBe(60);
  });
});
