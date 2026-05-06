import * as fs from 'fs';
import * as readline from 'readline';

export interface SdpRow {
  msisdn: string;
  event_at: Date;
  /** Naira value as string with 2 decimal places. */
  amount_naira: string;
  raw: any;
  line_no: number;
  external_id: string;
}

export interface SdpRowError {
  error: string;
  raw: string;
  line_no: number;
}

/**
 * Parses a `|`-delimited SDP CDR file line-by-line.
 * Format: msisdn | iso_datetime | amount_naira [| ...extra fields]
 *
 * Skips blank lines and lines starting with `#`.
 * On parse error yields an error object; on success yields a SdpRow.
 */
export async function* parseSdp(
  filePath: string,
): AsyncGenerator<SdpRow | SdpRowError> {
  const rl = readline.createInterface({
    input: fs.createReadStream(filePath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });

  let lineNo = 0;

  for await (const line of rl) {
    lineNo++;
    const trimmed = line.trim();

    // Skip blank lines and comment lines
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const parts = trimmed.split('|').map((p) => p.trim());

    if (parts.length < 3) {
      yield { error: 'insufficient fields (need at least 3)', raw: line, line_no: lineNo };
      continue;
    }

    const [msisdn, dateStr, amountStr] = parts;

    if (!msisdn) {
      yield { error: 'empty msisdn', raw: line, line_no: lineNo };
      continue;
    }

    const eventAt = new Date(dateStr);
    if (isNaN(eventAt.getTime())) {
      yield { error: `invalid date: ${dateStr}`, raw: line, line_no: lineNo };
      continue;
    }

    const amountNum = parseFloat(amountStr);
    if (isNaN(amountNum)) {
      yield { error: `invalid amount: ${amountStr}`, raw: line, line_no: lineNo };
      continue;
    }

    const amountNaira = amountNum.toFixed(2);
    const eventAtIso = eventAt.toISOString();
    const external_id = `${msisdn}|${eventAtIso}|${amountStr}`;

    const raw: Record<string, string> = {};
    parts.forEach((val, idx) => {
      raw[`field${idx}`] = val;
    });

    yield { msisdn, event_at: eventAt, amount_naira: amountNaira, raw, line_no: lineNo, external_id };
  }
}
