import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { parseRefill, RefillRow, RefillRowError } from './refill.parser';

function writeTmp(content: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'refill-parser-'));
  const p = path.join(dir, 'recharges.csv');
  fs.writeFileSync(p, content);
  return p;
}

async function collect<T>(it: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const v of it) out.push(v);
  return out;
}

describe('parseRefill (CSV)', () => {
  it('parses a valid Airtel refill CSV row', async () => {
    const f = writeTmp(
      [
        'servedmsisdn,transactionTime,transactionAmount,serviceClass',
        '2347010892868,2025-12-19 09:28:25.0,100.50,378',
      ].join('\n') + '\n',
    );

    const rows = await collect(parseRefill(f));
    expect(rows).toHaveLength(1);
    const row = rows[0] as RefillRow;
    expect(row.msisdn).toBe('2347010892868');
    expect(row.amount_naira).toBe('100.50');
    expect(row.service_class).toBe(378);
    // 09:28 Lagos (UTC+1, no DST) => 08:28 UTC.
    expect(row.event_at.toISOString()).toBe('2025-12-19T08:28:25.000Z');
  });

  it('normalizes a local-format MSISDN via toE164Nigerian', async () => {
    const f = writeTmp(
      [
        'servedmsisdn,transactionTime,transactionAmount',
        '07010892868,2025-12-19 09:28:25.0,100',
      ].join('\n') + '\n',
    );
    const rows = await collect(parseRefill(f));
    const ok = rows[0] as RefillRow;
    expect('msisdn' in ok).toBe(true);
    expect(ok.msisdn).toBe('2347010892868');
  });

  it('rejects an unnormalisable MSISDN', async () => {
    const f = writeTmp(
      [
        'servedmsisdn,transactionTime,transactionAmount',
        'not-a-phone,2025-12-19 09:28:25.0,100',
      ].join('\n') + '\n',
    );
    const rows = await collect(parseRefill(f));
    expect(rows).toHaveLength(1);
    const err = rows[0] as RefillRowError;
    expect(err.error).toMatch(/invalid msisdn/i);
  });

  it('rejects negative amounts', async () => {
    const f = writeTmp(
      [
        'servedmsisdn,transactionTime,transactionAmount',
        '2347010892868,2025-12-19 09:28:25.0,-1.0',
      ].join('\n') + '\n',
    );
    const rows = await collect(parseRefill(f));
    const err = rows[0] as RefillRowError;
    expect(err.error).toMatch(/transactionAmount/);
  });

  it('throws if a required header is missing', async () => {
    const f = writeTmp(
      [
        'servedmsisdn,transactionAmount',
        '2347010892868,100',
      ].join('\n') + '\n',
    );
    await expect(collect(parseRefill(f))).rejects.toThrow(/transactionTime/);
  });
});
