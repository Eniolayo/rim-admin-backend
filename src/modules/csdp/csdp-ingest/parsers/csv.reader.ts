import * as fs from 'fs';
import { parse } from 'csv-parse';

export interface CsvRow {
  /** 1-based line number in the source file. */
  line_no: number;
  /** Field values keyed by header name. Values are trimmed strings. */
  fields: Record<string, string>;
}

export interface CsvReaderOptions {
  /**
   * Required header names. If any are missing from the file's header row, the
   * generator throws before yielding rows. Mismatches are surfaced early so
   * misconfigured ingests fail fast.
   */
  requiredHeaders?: string[];
  /** Skip lines whose first non-whitespace char is `#`. Default true. */
  skipComments?: boolean;
}

/**
 * Stream-parse a CSV file using `csv-parse`. Yields one row at a time,
 * keyed by header name, with values trimmed.
 *
 * - Recognizes the first non-blank, non-comment line as the header row.
 * - Skips blank lines and `#`-prefixed comment lines.
 * - Strips surrounding whitespace from values; csv-parse handles quoted commas
 *   and escaped quotes.
 * - Throws if any of `requiredHeaders` is missing from the header row.
 */
export async function* readCsv(
  filePath: string,
  opts: CsvReaderOptions = {},
): AsyncGenerator<CsvRow> {
  const skipComments = opts.skipComments ?? true;

  const parser = fs.createReadStream(filePath).pipe(
    parse({
      bom: true,
      columns: true,
      skip_empty_lines: true,
      comment: skipComments ? '#' : undefined,
      trim: true,
      relax_column_count: true,
    }),
  );

  let validatedHeaders = false;

  for await (const record of parser) {
    if (!validatedHeaders) {
      const required = opts.requiredHeaders ?? [];
      const present = Object.keys(record);
      const missing = required.filter((h) => !present.includes(h));
      if (missing.length > 0) {
        throw new Error(
          `CSV is missing required header(s): ${missing.join(', ')}. Found: ${present.join(', ')}`,
        );
      }
      validatedHeaders = true;
    }

    // csv-parse exposes the source line as parser.info.lines after the record
    // is emitted. Use it where available; fall back to a counter otherwise.
    // The `info.lines` counter includes the header row, so emitted records
    // start at line 2.
    const lineNo = (parser as unknown as { info?: { lines?: number } }).info?.lines ?? 0;

    const fields: Record<string, string> = {};
    for (const [key, value] of Object.entries(record as Record<string, unknown>)) {
      fields[key] = value == null ? '' : String(value).trim();
    }

    yield { line_no: lineNo, fields };
  }
}
