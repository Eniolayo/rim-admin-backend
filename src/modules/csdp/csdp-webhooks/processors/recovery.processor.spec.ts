import { RecoveryProcessor, RecoveryJobPayload } from './recovery.processor';

interface CapturedQuery {
  sql: string;
  params?: unknown[];
}

/**
 * Mocks the `manager.query()` interface, returning canned data for SELECTs
 * and capturing every call. `priorStatusByLoan` is a per-call queue keyed
 * by loan_id reflecting the SELECT-FOR-UPDATE result on that loan.
 */
function makeFixture(opts: {
  priorByLoan: Record<
    string,
    Array<{ status: string; repayable_naira: string } | null>
  >;
  outstandingTotal: string;
}) {
  const captured: CapturedQuery[] = [];
  const priorByLoan = { ...opts.priorByLoan };

  const manager = {
    async query(sql: string, params?: unknown[]) {
      captured.push({ sql, params });
      const t = sql.trim();
      if (t.startsWith('SELECT status, repayable_naira FROM csdp_loan')) {
        const loanId = String(params?.[0]);
        const queue = priorByLoan[loanId] ?? [];
        const next = queue.shift();
        return next ? [next] : [];
      }
      if (t.startsWith('SELECT COALESCE(SUM(repayable_naira)')) {
        return [{ total: opts.outstandingTotal }];
      }
      // INSERTs / UPDATEs / live-writer queries — no return value used
      return [];
    },
  };

  return {
    captured,
    dataSource: {
      transaction: async (cb: (m: typeof manager) => Promise<unknown>) =>
        cb(manager),
    },
  };
}

const featureRow = {
  onLoanRecovered: jest.fn().mockResolvedValue(undefined),
} as unknown as never;

beforeEach(() => {
  (featureRow as { onLoanRecovered: jest.Mock }).onLoanRecovered.mockClear();
});

const payload: RecoveryJobPayload = {
  recovery_id: 'RX-1',
  msisdn: '08012345678',
  amount_naira: '110',
  recovered_at: '2026-02-01T00:00:00Z',
  loan_items: [{ loan_id: 'LN-1', amount_applied_naira: '110' }],
  inbound_log_id: 'LOG-1',
};

describe('RecoveryProcessor — replay regression', () => {
  it('inserts csdp_recovery with ON CONFLICT (recovery_id) DO NOTHING', async () => {
    const { dataSource, captured } = makeFixture({
      priorByLoan: {
        'LN-1': [{ status: 'ISSUED', repayable_naira: '110' }],
      },
      outstandingTotal: '0',
    });
    const processor = new RecoveryProcessor(
      dataSource as never,
      {} as never,
      featureRow,
    );

    await processor.process({ id: '1', data: payload } as never);

    const recoveryInsert = captured.find((q) =>
      q.sql.includes('INSERT INTO csdp_recovery'),
    );
    expect(recoveryInsert).toBeDefined();
    expect(recoveryInsert!.sql).toContain(
      'ON CONFLICT (recovery_id) DO NOTHING',
    );
  });

  it('inserts csdp_recovery_loan_item with ON CONFLICT (recovery_id, loan_id) DO NOTHING — duplicate items in payload do not break', async () => {
    const dupePayload: RecoveryJobPayload = {
      ...payload,
      loan_items: [
        { loan_id: 'LN-1', amount_applied_naira: '55' },
        { loan_id: 'LN-1', amount_applied_naira: '55' },
      ],
    };
    const { dataSource, captured } = makeFixture({
      priorByLoan: {
        'LN-1': [
          { status: 'ISSUED', repayable_naira: '110' },
          { status: 'RECOVERED', repayable_naira: '110' },
        ],
      },
      outstandingTotal: '0',
    });
    const processor = new RecoveryProcessor(
      dataSource as never,
      {} as never,
      featureRow,
    );

    await processor.process({ id: '2', data: dupePayload } as never);

    const lineItemInserts = captured.filter((q) =>
      q.sql.includes('INSERT INTO csdp_recovery_loan_item'),
    );
    expect(lineItemInserts).toHaveLength(2);
    for (const q of lineItemInserts) {
      expect(q.sql).toContain('ON CONFLICT (recovery_id, loan_id) DO NOTHING');
    }
    // Only the first iteration flips status; second is a no-op.
    expect(
      (featureRow as { onLoanRecovered: jest.Mock }).onLoanRecovered,
    ).toHaveBeenCalledTimes(1);
  });

  it('does not double-flip status: UPDATE skipped when prior status is RECOVERED', async () => {
    const { dataSource, captured } = makeFixture({
      priorByLoan: {
        'LN-1': [{ status: 'RECOVERED', repayable_naira: '110' }],
      },
      outstandingTotal: '0',
    });
    const processor = new RecoveryProcessor(
      dataSource as never,
      {} as never,
      featureRow,
    );

    await processor.process({ id: '3', data: payload } as never);

    const flipUpdate = captured.find((q) =>
      q.sql.includes("SET status       = 'RECOVERED'"),
    );
    expect(flipUpdate).toBeUndefined();

    const subscriberWrite = captured.find((q) =>
      q.sql.includes('INSERT INTO csdp_subscriber'),
    );
    expect(subscriberWrite!.params?.[2]).toBe(0);
    expect(
      (featureRow as { onLoanRecovered: jest.Mock }).onLoanRecovered,
    ).not.toHaveBeenCalled();
  });

  it('counts only newly recovered loans (replay-safe loans_recovered increment)', async () => {
    const multiPayload: RecoveryJobPayload = {
      ...payload,
      loan_items: [
        { loan_id: 'LN-1', amount_applied_naira: '110' },
        { loan_id: 'LN-2', amount_applied_naira: '50' },
      ],
    };
    const { dataSource, captured } = makeFixture({
      priorByLoan: {
        'LN-1': [{ status: 'ISSUED', repayable_naira: '110' }],
        'LN-2': [{ status: 'RECOVERED', repayable_naira: '50' }],
      },
      outstandingTotal: '0',
    });
    const processor = new RecoveryProcessor(
      dataSource as never,
      {} as never,
      featureRow,
    );

    await processor.process({ id: '4', data: multiPayload } as never);

    const subscriberWrite = captured.find((q) =>
      q.sql.includes('INSERT INTO csdp_subscriber'),
    );
    expect(subscriberWrite!.params?.[2]).toBe(1);
    expect(
      (featureRow as { onLoanRecovered: jest.Mock }).onLoanRecovered,
    ).toHaveBeenCalledTimes(1);
  });

  it('passes wasDefaulted=true to the live writer when prior status was DEFAULTED', async () => {
    const { dataSource } = makeFixture({
      priorByLoan: {
        'LN-1': [{ status: 'DEFAULTED', repayable_naira: '110' }],
      },
      outstandingTotal: '0',
    });
    const processor = new RecoveryProcessor(
      dataSource as never,
      {} as never,
      featureRow,
    );

    await processor.process({ id: '5', data: payload } as never);

    const mock = (featureRow as { onLoanRecovered: jest.Mock })
      .onLoanRecovered;
    expect(mock).toHaveBeenCalledTimes(1);
    expect(mock.mock.calls[0][0]).toBe('2348012345678');
    expect(mock.mock.calls[0][1]).toBe('110');
    expect(mock.mock.calls[0][2]).toBe(true);
  });

  it('passes wasDefaulted=false when prior status was ISSUED', async () => {
    const { dataSource } = makeFixture({
      priorByLoan: {
        'LN-1': [{ status: 'ISSUED', repayable_naira: '110' }],
      },
      outstandingTotal: '0',
    });
    const processor = new RecoveryProcessor(
      dataSource as never,
      {} as never,
      featureRow,
    );

    await processor.process({ id: '6', data: payload } as never);

    const mock = (featureRow as { onLoanRecovered: jest.Mock })
      .onLoanRecovered;
    expect(mock).toHaveBeenCalledTimes(1);
    expect(mock.mock.calls[0][2]).toBe(false);
  });
});
