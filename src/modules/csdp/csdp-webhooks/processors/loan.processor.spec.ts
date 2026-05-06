import { LoanProcessor, LoanJobPayload } from './loan.processor';

interface CapturedQuery {
  sql: string;
  params?: unknown[];
}

function makeManager(state: {
  existingStatus: string | null;
  outstandingTotal: string;
}) {
  const captured: CapturedQuery[] = [];
  const manager = {
    async query(sql: string, params?: unknown[]) {
      captured.push({ sql, params });
      const trimmed = sql.trim();
      if (trimmed.startsWith('SELECT status FROM csdp_loan')) {
        return state.existingStatus !== null
          ? [{ status: state.existingStatus }]
          : [];
      }
      if (trimmed.startsWith('SELECT COALESCE(SUM(repayable_naira)')) {
        return [{ total: state.outstandingTotal }];
      }
      return [];
    },
  };
  return { manager, captured };
}

function makeDataSource(state: {
  existingStatus: string | null;
  outstandingTotal: string;
}) {
  const { manager, captured } = makeManager(state);
  return {
    captured,
    dataSource: {
      transaction: async (cb: (m: typeof manager) => Promise<unknown>) =>
        cb(manager),
    },
  };
}

const featureRow = {
  onLoanIssued: jest.fn().mockResolvedValue(undefined),
} as unknown as never;

const counters = {
  recordDisbursement: jest.fn().mockResolvedValue(undefined),
} as unknown as never;

const loanSnapshot = {
  snapshotLoan: jest.fn().mockResolvedValue(undefined),
} as unknown as never;

beforeEach(() => {
  (featureRow as { onLoanIssued: jest.Mock }).onLoanIssued.mockClear();
  (counters as { recordDisbursement: jest.Mock }).recordDisbursement.mockClear();
  (loanSnapshot as { snapshotLoan: jest.Mock }).snapshotLoan.mockClear();
});

const basePayload: LoanJobPayload = {
  loan_id: 'LN-1',
  msisdn: '08012345678',
  vendor: 'AVYRA',
  loan_type: 'AIRTIME',
  principal_naira: '100',
  repayable_naira: '110',
  status: 'ISSUED',
  trans_ref: 'TX-1',
  issued_at: '2026-01-01T00:00:00Z',
  inbound_log_id: 'LOG-1',
};

describe('LoanProcessor — replay regression', () => {
  it('UPSERTs csdp_loan with ON CONFLICT (loan_id) DO UPDATE — replay does not duplicate rows', async () => {
    const { dataSource, captured } = makeDataSource({
      existingStatus: null,
      outstandingTotal: '110',
    });
    const processor = new LoanProcessor(
      dataSource as never,
      {} as never,
      featureRow,
      counters,
      loanSnapshot,
    );

    await processor.process({ id: '1', data: basePayload } as never);

    const firstUpsert = captured.find((q) =>
      q.sql.includes('INSERT INTO csdp_loan'),
    );
    expect(firstUpsert).toBeDefined();
    expect(firstUpsert!.sql).toContain('ON CONFLICT (loan_id) DO UPDATE');
  });

  it('does NOT increment loans_taken on replay (priorStatus !== null path)', async () => {
    const { dataSource, captured } = makeDataSource({
      existingStatus: 'ISSUED',
      outstandingTotal: '110',
    });
    const processor = new LoanProcessor(
      dataSource as never,
      {} as never,
      featureRow,
      counters,
      loanSnapshot,
    );

    await processor.process({ id: '2', data: basePayload } as never);

    const subscriberWrites = captured.filter((q) =>
      q.sql.includes('INSERT INTO csdp_subscriber'),
    );
    expect(subscriberWrites).toHaveLength(1);
    expect(subscriberWrites[0].sql).not.toContain(
      'csdp_subscriber.loans_taken + 1',
    );
    expect(subscriberWrites[0].sql).toContain(
      'outstanding_naira = EXCLUDED.outstanding_naira',
    );
    // Live writer is the replay-sensitive path: replay must not bump
    // loans_taken_180d.
    expect(
      (featureRow as { onLoanIssued: jest.Mock }).onLoanIssued,
    ).not.toHaveBeenCalled();
  });

  it('increments loans_taken only on first delivery (priorStatus === null) and calls live writer', async () => {
    const { dataSource, captured } = makeDataSource({
      existingStatus: null,
      outstandingTotal: '110',
    });
    const processor = new LoanProcessor(
      dataSource as never,
      {} as never,
      featureRow,
      counters,
      loanSnapshot,
    );

    await processor.process({ id: '3', data: basePayload } as never);

    const incrementWrite = captured.find((q) =>
      q.sql.includes('csdp_subscriber.loans_taken + 1'),
    );
    expect(incrementWrite).toBeDefined();

    const mock = (featureRow as { onLoanIssued: jest.Mock }).onLoanIssued;
    expect(mock).toHaveBeenCalledTimes(1);
    expect(mock.mock.calls[0][0]).toBe('2348012345678');
    expect(mock.mock.calls[0][1]).toBe('110');

    const record = (counters as { recordDisbursement: jest.Mock })
      .recordDisbursement;
    expect(record).toHaveBeenCalledTimes(1);
    expect(record.mock.calls[0][0]).toBe('2348012345678');
    expect(record.mock.calls[0][1]).toBe('LN-1');
    expect(record.mock.calls[0][2]).toBe('110');

    const snap = (loanSnapshot as { snapshotLoan: jest.Mock }).snapshotLoan;
    expect(snap).toHaveBeenCalledTimes(1);
    expect(snap.mock.calls[0]).toEqual(['LN-1', '2348012345678', 'TX-1']);
  });

  it('does NOT snapshot on replay (priorStatus !== null)', async () => {
    const { dataSource } = makeDataSource({
      existingStatus: 'ISSUED',
      outstandingTotal: '110',
    });
    const processor = new LoanProcessor(
      dataSource as never,
      {} as never,
      featureRow,
      counters,
      loanSnapshot,
    );

    await processor.process({ id: 'replay', data: basePayload } as never);

    expect(
      (loanSnapshot as { snapshotLoan: jest.Mock }).snapshotLoan,
    ).not.toHaveBeenCalled();
  });

  it('does not call live writer when status is not ISSUED (status-only update)', async () => {
    const { dataSource } = makeDataSource({
      existingStatus: null,
      outstandingTotal: '0',
    });
    const processor = new LoanProcessor(
      dataSource as never,
      {} as never,
      featureRow,
      counters,
      loanSnapshot,
    );

    await processor.process({
      id: '4',
      data: { ...basePayload, status: 'RECOVERED' },
    } as never);

    expect(
      (featureRow as { onLoanIssued: jest.Mock }).onLoanIssued,
    ).not.toHaveBeenCalled();
  });
});
