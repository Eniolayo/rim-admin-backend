import { ProfileIdempotencyService } from './profile-idempotency.service';

function makeDataSource(rows: unknown[]) {
  const captured: Array<{ sql: string; params: unknown[] }> = [];
  return {
    captured,
    dataSource: {
      query: jest.fn(async (sql: string, params: unknown[]) => {
        captured.push({ sql, params });
        return rows;
      }),
    },
  };
}

describe('ProfileIdempotencyService.lookup', () => {
  it('returns null when no recent log row exists for the trans_ref', async () => {
    const { dataSource } = makeDataSource([]);
    const svc = new ProfileIdempotencyService(dataSource as never);
    expect(await svc.lookup('TX-X')).toBeNull();
  });

  it('STUB winner → "0"', async () => {
    const { dataSource } = makeDataSource([
      {
        winner: 'STUB',
        decision_mode: 'STUB_DENY',
        teamwee_limit_naira: null,
        rim_limit_naira: null,
        final_limit_naira: null,
      },
    ]);
    const svc = new ProfileIdempotencyService(dataSource as never);
    const cached = await svc.lookup('TX-1');
    expect(cached?.responseLimitNaira).toBe('0');
    expect(cached?.winner).toBe('STUB');
  });

  it('TEAMWEE winner → teamwee_limit_naira', async () => {
    const { dataSource } = makeDataSource([
      {
        winner: 'TEAMWEE',
        decision_mode: 'PROXY',
        teamwee_limit_naira: '500',
        rim_limit_naira: null,
        final_limit_naira: null,
      },
    ]);
    const svc = new ProfileIdempotencyService(dataSource as never);
    expect((await svc.lookup('TX-2'))?.responseLimitNaira).toBe('500');
  });

  it('RIM winner → rim_limit_naira (falls back to final_limit_naira if string column null)', async () => {
    const { dataSource } = makeDataSource([
      {
        winner: 'RIM',
        decision_mode: 'LIVE_5',
        teamwee_limit_naira: null,
        rim_limit_naira: null,
        final_limit_naira: 750,
      },
    ]);
    const svc = new ProfileIdempotencyService(dataSource as never);
    expect((await svc.lookup('TX-3'))?.responseLimitNaira).toBe('750');
  });

  it('FALLBACK winner → "0"', async () => {
    const { dataSource } = makeDataSource([
      {
        winner: 'FALLBACK',
        decision_mode: 'PROXY',
        teamwee_limit_naira: null,
        rim_limit_naira: null,
        final_limit_naira: null,
      },
    ]);
    const svc = new ProfileIdempotencyService(dataSource as never);
    expect((await svc.lookup('TX-4'))?.responseLimitNaira).toBe('0');
  });

  it('queries with the 24h window', async () => {
    const { dataSource, captured } = makeDataSource([]);
    const svc = new ProfileIdempotencyService(dataSource as never);
    await svc.lookup('TX-5');
    expect(captured[0].params).toEqual(['TX-5', 24]);
    expect(captured[0].sql).toContain('trans_ref');
    expect(captured[0].sql).toContain('ORDER BY requested_at DESC');
  });
});
