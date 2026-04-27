import * as fs from 'fs';
import * as readline from 'readline';

export interface VendorRow {
  kind: 'loan' | 'recovery';
  payload: Record<string, string>;
  line_no: number;
  external_id: string;
}

export interface VendorRowError {
  error: string;
  raw: string;
  line_no: number;
}

/**
 * Parses a CSV-like vendor dump file (header line + comma-delimited rows).
 * Expects a `record_type` column to distinguish loan vs. recovery rows.
 * An `id` or `loan_id` / `recovery_id` column is used as the external_id.
 *
 * TODO: Add proper quoted-field handling (RFC 4180) — current naive comma-split
 *       will break on fields containing commas enclosed in quotes.
 */
export async function* parseVendor(
  filePath: string,
): AsyncGenerator<VendorRow | VendorRowError> {
  const rl = readline.createInterface({
    input: fs.createReadStream(filePath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });

  let lineNo = 0;
  let headers: string[] | null = null;

  for await (const line of rl) {
    lineNo++;
    const trimmed = line.trim();

    // Skip blank lines and comment lines
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    if (headers === null) {
      // First non-blank, non-comment line is the header
      headers = trimmed.split(',').map((h) => h.trim().toLowerCase());
      continue;
    }

    const values = trimmed.split(',').map((v) => v.trim());

    if (values.length !== headers.length) {
      yield {
        error: `column count mismatch: expected ${headers.length}, got ${values.length}`,
        raw: line,
        line_no: lineNo,
      };
      continue;
    }

    const payload: Record<string, string> = {};
    headers.forEach((h, i) => {
      payload[h] = values[i];
    });

    const recordType = (payload['record_type'] ?? '').toLowerCase();

    if (recordType !== 'loan' && recordType !== 'recovery') {
      yield {
        error: `unknown record_type: "${payload['record_type']}"`,
        raw: line,
        line_no: lineNo,
      };
      continue;
    }

    const kind = recordType as 'loan' | 'recovery';

    // Derive external_id from id / loan_id / recovery_id columns, or fallback
    const external_id =
      payload['loan_id'] ??
      payload['recovery_id'] ??
      payload['id'] ??
      `${lineNo}`;

    yield { kind, payload, line_no: lineNo, external_id };
  }

  if (headers === null) {
    // File had no parseable content — not an error at the generator level
  }
}
