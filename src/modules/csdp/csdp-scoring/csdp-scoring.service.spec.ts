import { CsdpScoringService } from './csdp-scoring.service';
import { DEFAULT_CSDP_CONFIG } from './heuristic-v3';
import { WORKED_EXAMPLES } from './__fixtures__/golden-vectors';

function makeFixture(opts: { systemExposurePct?: number } = {}) {
  const readModel = {
    read: jest.fn(),
    readSystemExposurePct: jest
      .fn()
      .mockResolvedValue(opts.systemExposurePct ?? 0),
  };
  const configLoader = {
    load: jest.fn().mockResolvedValue(DEFAULT_CSDP_CONFIG),
  };
  const histogram = { observe: jest.fn() };
  const svc = new CsdpScoringService(
    readModel as never,
    configLoader as never,
    histogram as never,
  );
  return { svc, readModel, configLoader, histogram };
}

describe('CsdpScoringService.score — golden vectors via integration layer', () => {
  for (const example of WORKED_EXAMPLES) {
    it(`${example.name}`, async () => {
      const { svc, readModel } = makeFixture({
        systemExposurePct: example.systemExposurePct,
      });
      readModel.read.mockResolvedValue(example.features);

      const { result, features, systemExposurePct } = await svc.score({
        msisdn: example.features.msisdn,
        daKobo: example.request.daKobo,
        loanType: example.request.loanType,
      });

      expect(result.score).toBe(example.expected.score);
      expect(result.finalLimitNaira).toBe(example.expected.finalLimitNaira);
      if (example.expected.gateFailed !== undefined) {
        expect(result.gateFailed).toBe(example.expected.gateFailed);
      }
      expect(result.modelVersion).toBe('heuristic_v3');
      expect(features).toBe(example.features);
      expect(systemExposurePct).toBe(example.systemExposurePct);
    });
  }
});

describe('CsdpScoringService.score — wiring', () => {
  it('reads features, exposure, and config in parallel', async () => {
    const { svc, readModel, configLoader } = makeFixture({
      systemExposurePct: 0.42,
    });
    readModel.read.mockResolvedValue({
      msisdn: '2348012345678',
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
      eligibilityChecks1h: 1,
    });

    await svc.score({
      msisdn: '2348012345678',
      daKobo: 50000,
      loanType: 'AIRTIME',
    });

    expect(readModel.read).toHaveBeenCalledWith('2348012345678');
    expect(readModel.readSystemExposurePct).toHaveBeenCalled();
    expect(configLoader.load).toHaveBeenCalled();
  });

  it('observes engine latency histogram', async () => {
    const { svc, readModel, histogram } = makeFixture();
    readModel.read.mockResolvedValue({
      msisdn: '2348012345678',
      blacklisted: false,
      daysOnNetwork: 730,
      rechargeCount30d: 12,
      loansTaken180d: 0,
      loansRecovered180d: 0,
      historicalCuredDefaults180d: 0,
      historicalCuredDefaultsLifetime: 0,
      uncuredDefaultExists: false,
      ourOutstandingKobo: 0,
      ourDisbursed24hNaira: 0,
      eligibilityChecks1h: 1,
    });

    await svc.score({
      msisdn: '2348012345678',
      daKobo: 0,
      loanType: 'AIRTIME',
    });

    expect(histogram.observe).toHaveBeenCalledTimes(1);
    expect(histogram.observe.mock.calls[0][0]).toBeGreaterThanOrEqual(0);
  });

  it('blacklist gate fires when read model reports blacklisted=true', async () => {
    const { svc, readModel } = makeFixture();
    readModel.read.mockResolvedValue({
      msisdn: '2348012345678',
      blacklisted: true,
      daysOnNetwork: 730,
      rechargeCount30d: 12,
      loansTaken180d: 5,
      loansRecovered180d: 5,
      historicalCuredDefaults180d: 0,
      historicalCuredDefaultsLifetime: 0,
      uncuredDefaultExists: false,
      ourOutstandingKobo: 0,
      ourDisbursed24hNaira: 0,
      eligibilityChecks1h: 1,
    });

    const { result } = await svc.score({
      msisdn: '2348012345678',
      daKobo: 0,
      loanType: 'AIRTIME',
    });

    expect(result.gateFailed).toBe('BLACKLIST');
    expect(result.finalLimitNaira).toBe(0);
  });
});
