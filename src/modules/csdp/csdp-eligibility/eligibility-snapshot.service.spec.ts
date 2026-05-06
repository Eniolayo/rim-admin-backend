import { EligibilitySnapshotService } from './eligibility-snapshot.service';
import { CsdpFeatureRow } from '../csdp-scoring/heuristic-v3';

const features: CsdpFeatureRow = {
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
};

describe('EligibilitySnapshotService.write', () => {
  it('INSERTs into csdp_eligibility_features_snapshot with ON CONFLICT (trans_ref) DO NOTHING', async () => {
    const captured: Array<{ sql: string; params: unknown[] }> = [];
    const dataSource = {
      query: jest.fn(async (sql: string, params: unknown[]) => {
        captured.push({ sql, params });
        return [];
      }),
    };
    const svc = new EligibilitySnapshotService(dataSource as never);

    await svc.write('TX-1', '2348012345678', features);

    expect(captured).toHaveLength(1);
    expect(captured[0].sql).toContain(
      'INSERT INTO csdp_eligibility_features_snapshot',
    );
    expect(captured[0].sql).toContain('ON CONFLICT (trans_ref) DO NOTHING');
    expect(captured[0].sql).toContain('$3::jsonb');
    expect(captured[0].params[0]).toBe('TX-1');
    expect(captured[0].params[1]).toBe('2348012345678');
    expect(JSON.parse(captured[0].params[2] as string)).toEqual(features);
  });
});
