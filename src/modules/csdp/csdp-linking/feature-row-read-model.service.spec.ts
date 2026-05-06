import { FeatureRowReadModel } from './feature-row-read-model.service';

function makeFixture(opts: {
  featureRow?: Record<string, unknown> | null;
  blacklisted?: boolean | null;
  disbursed24h?: number;
  eligChecks1h?: number;
  systemExposurePct?: number;
}) {
  const dataSource = {
    query: jest.fn(async (sql: string) => {
      if (sql.includes('FROM csdp_subscriber_feature_row')) {
        return opts.featureRow ? [opts.featureRow] : [];
      }
      if (sql.includes('FROM csdp_credit_profile')) {
        return opts.blacklisted == null
          ? []
          : [{ blacklisted: opts.blacklisted }];
      }
      return [];
    }),
  };
  const counters = {
    sumDisbursed24hNaira: jest
      .fn()
      .mockResolvedValue(opts.disbursed24h ?? 0),
    getEligibilityChecks1h: jest
      .fn()
      .mockResolvedValue(opts.eligChecks1h ?? 0),
    getSystemExposurePct: jest
      .fn()
      .mockResolvedValue(opts.systemExposurePct ?? 0),
  };
  return {
    dataSource: dataSource as never,
    counters: counters as never,
    rawCounters: counters,
  };
}

describe('FeatureRowReadModel.read', () => {
  it('composes feature row from PG row + credit profile + Redis counters', async () => {
    const { dataSource, counters } = makeFixture({
      featureRow: {
        days_on_network: 90,
        recharge_count_30d: 12,
        loans_taken_180d: 5,
        loans_recovered_180d: 4,
        historical_cured_defaults_180d: 1,
        historical_cured_defaults_lifetime: 2,
        uncured_default_exists: false,
        our_outstanding_kobo: '50000',
      },
      blacklisted: false,
      disbursed24h: 200,
      eligChecks1h: 3,
    });
    const svc = new FeatureRowReadModel(dataSource, counters);

    const result = await svc.read('2348012345678');

    expect(result).toEqual({
      msisdn: '2348012345678',
      blacklisted: false,
      daysOnNetwork: 90,
      rechargeCount30d: 12,
      loansTaken180d: 5,
      loansRecovered180d: 4,
      historicalCuredDefaults180d: 1,
      historicalCuredDefaultsLifetime: 2,
      uncuredDefaultExists: false,
      ourOutstandingKobo: 50000,
      ourDisbursed24hNaira: 200,
      eligibilityChecks1h: 3,
    });
  });

  it('cold MSISDN — no feature row, no profile — returns zero defaults and blacklisted=false', async () => {
    const { dataSource, counters } = makeFixture({
      featureRow: null,
      blacklisted: null,
    });
    const svc = new FeatureRowReadModel(dataSource, counters);

    const result = await svc.read('2348012345678');

    expect(result.blacklisted).toBe(false);
    expect(result.daysOnNetwork).toBe(0);
    expect(result.loansTaken180d).toBe(0);
    expect(result.uncuredDefaultExists).toBe(false);
    expect(result.ourOutstandingKobo).toBe(0);
    expect(result.ourDisbursed24hNaira).toBe(0);
    expect(result.eligibilityChecks1h).toBe(0);
  });

  it('blacklist flag flows from credit profile', async () => {
    const { dataSource, counters } = makeFixture({
      featureRow: null,
      blacklisted: true,
    });
    const svc = new FeatureRowReadModel(dataSource, counters);

    expect((await svc.read('2348012345678')).blacklisted).toBe(true);
  });

  it('our_outstanding_kobo bigint string is converted to number', async () => {
    const { dataSource, counters } = makeFixture({
      featureRow: {
        days_on_network: 0,
        recharge_count_30d: 0,
        loans_taken_180d: 0,
        loans_recovered_180d: 0,
        historical_cured_defaults_180d: 0,
        historical_cured_defaults_lifetime: 0,
        uncured_default_exists: false,
        our_outstanding_kobo: '999999',
      },
      blacklisted: false,
    });
    const svc = new FeatureRowReadModel(dataSource, counters);

    expect((await svc.read('2348012345678')).ourOutstandingKobo).toBe(999999);
  });
});

describe('FeatureRowReadModel.readSystemExposurePct', () => {
  it('delegates to counter service', async () => {
    const { dataSource, counters, rawCounters } = makeFixture({
      systemExposurePct: 0.42,
    });
    const svc = new FeatureRowReadModel(dataSource, counters);

    expect(await svc.readSystemExposurePct()).toBeCloseTo(0.42);
    expect(rawCounters.getSystemExposurePct).toHaveBeenCalled();
  });
});
