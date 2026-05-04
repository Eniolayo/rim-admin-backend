import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { readCsv } from './csv.reader';

function writeTmp(name: string, content: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'csv-reader-'));
  const p = path.join(dir, name);
  fs.writeFileSync(p, content);
  return p;
}

async function collect<T>(it: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const v of it) out.push(v);
  return out;
}

describe('readCsv', () => {
  it('parses a basic CSV keyed by header', async () => {
    const f = writeTmp(
      'a.csv',
      'a,b,c\n1,2,3\n4,5,6\n',
    );
    const rows = await collect(readCsv(f));
    expect(rows).toHaveLength(2);
    expect(rows[0].fields).toEqual({ a: '1', b: '2', c: '3' });
    expect(rows[1].fields).toEqual({ a: '4', b: '5', c: '6' });
  });

  it('trims values and handles quoted commas', async () => {
    const f = writeTmp(
      'b.csv',
      'name,note\n  alice  ,"hello, world"\nbob,plain\n',
    );
    const rows = await collect(readCsv(f));
    expect(rows[0].fields).toEqual({ name: 'alice', note: 'hello, world' });
    expect(rows[1].fields).toEqual({ name: 'bob', note: 'plain' });
  });

  it('skips comment and blank lines', async () => {
    const f = writeTmp(
      'c.csv',
      '# header comment\nx,y\n# another\n1,2\n\n3,4\n',
    );
    const rows = await collect(readCsv(f));
    expect(rows).toHaveLength(2);
    expect(rows[0].fields).toEqual({ x: '1', y: '2' });
    expect(rows[1].fields).toEqual({ x: '3', y: '4' });
  });

  it('strips a UTF-8 BOM from the header', async () => {
    const f = writeTmp(
      'd.csv',
      '﻿servedmsisdn,transactionTime\n2347010892868,2025-12-19 09:28:25.0\n',
    );
    const rows = await collect(
      readCsv(f, { requiredHeaders: ['servedmsisdn', 'transactionTime'] }),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].fields.servedmsisdn).toBe('2347010892868');
  });

  it('throws when a required header is missing', async () => {
    const f = writeTmp('e.csv', 'a,b\n1,2\n');
    await expect(
      collect(readCsv(f, { requiredHeaders: ['a', 'c'] })),
    ).rejects.toThrow(/missing required header/i);
  });

  it('handles CRLF line endings', async () => {
    const f = writeTmp('f.csv', 'a,b\r\n1,2\r\n3,4\r\n');
    const rows = await collect(readCsv(f));
    expect(rows.map((r) => r.fields)).toEqual([
      { a: '1', b: '2' },
      { a: '3', b: '4' },
    ]);
  });
});
