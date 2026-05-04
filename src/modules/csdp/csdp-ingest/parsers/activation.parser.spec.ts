import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  parseActivation,
  ActivationRow,
  ActivationRowError,
} from './activation.parser';

function writeTmp(content: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'activation-parser-'));
  const p = path.join(dir, 'activation.csv');
  fs.writeFileSync(p, content);
  return p;
}

async function collect<T>(it: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const v of it) out.push(v);
  return out;
}

describe('parseActivation', () => {
  it('parses a valid activation row', async () => {
    const f = writeTmp(
      [
        'servedmsisdn,serviceclassid,accountactivateddate',
        '2347010892868,378,2024-03-15',
      ].join('\n') + '\n',
    );

    const rows = await collect(parseActivation(f));
    expect(rows).toHaveLength(1);
    const ok = rows[0] as ActivationRow;
    expect(ok.msisdn).toBe('2347010892868');
    expect(ok.activated_at).toBe('2024-03-15');
    expect(ok.service_class_id).toBe(378);
    expect(ok.external_id).toBe('2347010892868|2024-03-15');
  });

  it('accepts a row without serviceclassid (optional)', async () => {
    const f = writeTmp(
      [
        'servedmsisdn,accountactivateddate',
        '2347010892868,2024-03-15',
      ].join('\n') + '\n',
    );
    const rows = await collect(parseActivation(f));
    const ok = rows[0] as ActivationRow;
    expect(ok.service_class_id).toBeNull();
  });

  it('rejects malformed dates', async () => {
    const f = writeTmp(
      [
        'servedmsisdn,accountactivateddate',
        '2347010892868,15/03/2024',
      ].join('\n') + '\n',
    );
    const rows = await collect(parseActivation(f));
    const err = rows[0] as ActivationRowError;
    expect(err.error).toMatch(/accountactivateddate/);
  });

  it('rejects unnormalisable MSISDN', async () => {
    const f = writeTmp(
      [
        'servedmsisdn,accountactivateddate',
        'garbage,2024-03-15',
      ].join('\n') + '\n',
    );
    const rows = await collect(parseActivation(f));
    const err = rows[0] as ActivationRowError;
    expect(err.error).toMatch(/invalid msisdn/i);
  });

  it('throws on missing required header', async () => {
    const f = writeTmp(
      [
        'servedmsisdn,serviceclassid',
        '2347010892868,378',
      ].join('\n') + '\n',
    );
    await expect(collect(parseActivation(f))).rejects.toThrow(/accountactivateddate/);
  });
});
