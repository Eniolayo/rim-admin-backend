import { LoanSnapshotService } from './loan-snapshot.service';
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

function makeFixture(opts: {
  eligibilityRow?: { feature_row_snapshot: unknown } | null;
}) {
  const captured: Array<{ sql: string; params: unknown[] }> = [];
  const dataSource = {
    query: jest.fn(async (sql: string, params: unknown[]) => {
      captured.push({ sql, params });
      if (sql.includes('FROM csdp_eligibility_features_snapshot')) {
        return opts.eligibilityRow ? [opts.eligibilityRow] : [];
      }
      return [];
    }),
  };
  const readModel = {
    read: jest.fn().mockResolvedValue(features),
  };
  const counter = { inc: jest.fn() };
  const svc = new LoanSnapshotService(
    dataSource as never,
    readModel as never,
    counter as never,
  );
  return { svc, captured, readModel, counter };
}

describe('LoanSnapshotService.snapshotLoan', () => {
  it('copies forward from csdp_eligibility_features_snapshot when trans_ref hit', async () => {
    const eligibilitySnapshot = { ...features, daysOnNetwork: 999 };
    const { svc, captured, readModel, counter } = makeFixture({
      eligibilityRow: { feature_row_snapshot: eligibilitySnapshot },
    });

    await svc.snapshotLoan('LN-1', '2348012345678', 'TX-1');

    const lookup = captured.find((q) =>
      q.sql.includes('FROM csdp_eligibility_features_snapshot'),
    );
    const insert = captured.find((q) =>
      q.sql.includes('INSERT INTO csdp_loan_features_snapshot'),
    );

    expect(lookup!.params).toEqual(['TX-1']);
    expect(insert!.sql).toContain('ON CONFLICT (loan_id) DO NOTHING');
    expect(insert!.sql).toContain('$4::jsonb');
    expect(insert!.params[0]).toBe('LN-1');
    expect(insert!.params[1]).toBe('2348012345678');
    expect(insert!.params[2]).toBe('TX-1');
    expect(JSON.parse(insert!.params[3] as string)).toEqual(eligibilitySnapshot);
    expect(insert!.params[4]).toBe(false);

    expect(readModel.read).not.toHaveBeenCalled();
    expect(counter.inc).not.toHaveBeenCalled();
  });

  it('re-materializes via FeatureRowReadModel when trans_ref missing', async () => {
    const { svc, captured, readModel, counter } = makeFixture({});

    await svc.snapshotLoan('LN-2', '2348012345678', null);

    expect(readModel.read).toHaveBeenCalledWith('2348012345678');
    expect(counter.inc).toHaveBeenCalledTimes(1);

    // Eligibility lookup is skipped entirely when trans_ref is null.
    const lookup = captured.find((q) =>
      q.sql.includes('FROM csdp_eligibility_features_snapshot'),
    );
    expect(lookup).toBeUndefined();

    const insert = captured.find((q) =>
      q.sql.includes('INSERT INTO csdp_loan_features_snapshot'),
    );
    expect(insert!.params[2]).toBeNull(); // trans_ref
    expect(insert!.params[4]).toBe(true); // snapshot_mismatch
    expect(JSON.parse(insert!.params[3] as string)).toEqual(features);
  });

  it('re-materializes when trans_ref provided but no eligibility snapshot row exists (mismatch)', async () => {
    const { svc, captured, readModel, counter } = makeFixture({
      eligibilityRow: null,
    });

    await svc.snapshotLoan('LN-3', '2348012345678', 'TX-orphan');

    expect(readModel.read).toHaveBeenCalledWith('2348012345678');
    expect(counter.inc).toHaveBeenCalledTimes(1);

    const insert = captured.find((q) =>
      q.sql.includes('INSERT INTO csdp_loan_features_snapshot'),
    );
    expect(insert!.params[2]).toBe('TX-orphan');
    expect(insert!.params[4]).toBe(true);
  });
});
