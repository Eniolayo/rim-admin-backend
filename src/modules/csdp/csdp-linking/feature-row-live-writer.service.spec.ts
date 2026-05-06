import { FeatureRowLiveWriterService } from './feature-row-live-writer.service';

function makeFixture() {
  const captured: Array<{ sql: string; params: unknown[] }> = [];
  const manager = {
    query: jest.fn(async (sql: string, params: unknown[]) => {
      captured.push({ sql, params });
      return [];
    }),
  };
  return { manager, captured };
}

function newSvc() {
  // The service injects DataSource only to expose `dataSource.manager` as
  // a default executor when callers don't pass one. The tests below always
  // pass an explicit manager, so a stub DataSource is sufficient.
  const dataSource = { manager: undefined } as unknown as never;
  return new FeatureRowLiveWriterService(dataSource);
}

describe('FeatureRowLiveWriterService.onLoanIssued', () => {
  it('UPSERTs the row, incrementing loans_taken_180d and adding repayable kobo', async () => {
    const { manager, captured } = makeFixture();
    const svc = newSvc();

    await svc.onLoanIssued('2348012345678', '500.00', manager as never);

    expect(captured).toHaveLength(1);
    expect(captured[0].sql).toContain('INSERT INTO csdp_subscriber_feature_row');
    expect(captured[0].sql).toContain('ON CONFLICT (msisdn) DO UPDATE');
    expect(captured[0].sql).toContain(
      'csdp_subscriber_feature_row.loans_taken_180d + 1',
    );
    expect(captured[0].sql).toContain(
      'csdp_subscriber_feature_row.our_outstanding_kobo',
    );
    expect(captured[0].sql).toContain('($2::numeric * 100)::bigint');
    expect(captured[0].params).toEqual(['2348012345678', '500.00']);
  });
});

describe('FeatureRowLiveWriterService.onLoanRecovered', () => {
  it('decrements our_outstanding_kobo with GREATEST(..., 0) clamp and bumps loans_recovered_180d', async () => {
    const { manager, captured } = makeFixture();
    const svc = newSvc();

    await svc.onLoanRecovered(
      '2348012345678',
      '110.00',
      false,
      manager as never,
    );

    expect(captured).toHaveLength(1);
    expect(captured[0].sql).toContain('GREATEST(');
    expect(captured[0].sql).toContain(
      'csdp_subscriber_feature_row.our_outstanding_kobo - ($2::numeric * 100)::bigint',
    );
    expect(captured[0].sql).toContain(
      'csdp_subscriber_feature_row.loans_recovered_180d + 1',
    );
    expect(captured[0].params).toEqual(['2348012345678', '110.00', 0]);
  });

  it('credits historical_cured_defaults_* and refreshes uncured_default_exists when wasDefaulted=true', async () => {
    const { manager, captured } = makeFixture();
    const svc = newSvc();

    await svc.onLoanRecovered(
      '2348012345678',
      '110.00',
      true,
      manager as never,
    );

    expect(captured).toHaveLength(2);
    expect(captured[0].params).toEqual(['2348012345678', '110.00', 1]);
    expect(captured[0].sql).toContain('historical_cured_defaults_180d');
    expect(captured[0].sql).toContain('historical_cured_defaults_lifetime');
    expect(captured[1].sql).toContain(
      'uncured_default_exists = EXISTS',
    );
    expect(captured[1].params).toEqual(['2348012345678']);
  });

  it('does NOT issue the uncured_default_exists refresh when wasDefaulted=false', async () => {
    const { manager, captured } = makeFixture();
    const svc = newSvc();

    await svc.onLoanRecovered(
      '2348012345678',
      '110.00',
      false,
      manager as never,
    );

    expect(captured).toHaveLength(1);
    expect(captured[0].sql).not.toContain('uncured_default_exists');
  });
});
