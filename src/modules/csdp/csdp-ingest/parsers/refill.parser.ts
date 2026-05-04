import { fromZonedTime } from 'date-fns-tz';
import { toE164Nigerian } from '../../../../common/utils/phone.utils';
import { readCsv } from './csv.reader';

export interface RefillRow {
  msisdn: string;
  event_at: Date;
  amount_kobo: bigint;
  service_class: number | null;
  raw: Record<string, string>;
  line_no: number;
  external_id: string;
}

export interface RefillRowError {
  error: string;
  raw: string;
  line_no: number;
}

const REQUIRED_HEADERS = ['servedmsisdn', 'transactionTime', 'transactionAmount'];
const AIRTEL_TZ = 'Africa/Lagos';

/**
 * Parses an Airtel refill (recharges) CSV file streamingly.
 *
 * Required headers: servedmsisdn, transactionTime, transactionAmount.
 * Optional: serviceClass (recorded per-event; does not propagate to subscriber).
 *
 * `transactionTime` is a `YYYY-MM-DD HH:MM:SS.S` string with no timezone marker;
 * it is interpreted as Africa/Lagos wall-clock time so the resulting UTC instant
 * is correct regardless of where the worker runs.
 *
 * MSISDN is normalized via `toE164Nigerian`; any value that won't normalize is
 * rejected. No separate regex check.
 */
export async function* parseRefill(
  filePath: string,
): AsyncGenerator<RefillRow | RefillRowError> {
  const iterator = readCsv(filePath, { requiredHeaders: REQUIRED_HEADERS });

  for await (const row of iterator) {
    const lineNo = row.line_no;
    const fields = row.fields;

    const rawMsisdn = fields['servedmsisdn'];
    const dateStr = fields['transactionTime'];
    const amountStr = fields['transactionAmount'];
    const serviceClassStr = fields['serviceClass'];

    const rawLine = JSON.stringify(fields);

    if (!rawMsisdn) {
      yield { error: 'empty servedmsisdn', raw: rawLine, line_no: lineNo };
      continue;
    }

    const msisdn = toE164Nigerian(rawMsisdn);
    if (!msisdn) {
      yield { error: `invalid msisdn: ${rawMsisdn}`, raw: rawLine, line_no: lineNo };
      continue;
    }

    if (!dateStr) {
      yield { error: 'empty transactionTime', raw: rawLine, line_no: lineNo };
      continue;
    }

    const eventAt = fromZonedTime(dateStr, AIRTEL_TZ);
    if (isNaN(eventAt.getTime())) {
      yield { error: `invalid transactionTime: ${dateStr}`, raw: rawLine, line_no: lineNo };
      continue;
    }

    if (!amountStr) {
      yield { error: 'empty transactionAmount', raw: rawLine, line_no: lineNo };
      continue;
    }
    const amountNaira = parseFloat(amountStr);
    if (isNaN(amountNaira) || amountNaira < 0) {
      yield { error: `invalid transactionAmount: ${amountStr}`, raw: rawLine, line_no: lineNo };
      continue;
    }
    const amountKobo = BigInt(Math.round(amountNaira * 100));

    let serviceClass: number | null = null;
    if (serviceClassStr) {
      const parsed = parseInt(serviceClassStr, 10);
      if (!isNaN(parsed)) {
        serviceClass = parsed;
      }
    }

    const externalId = `${msisdn}|${eventAt.toISOString()}|${amountStr}`;

    yield {
      msisdn,
      event_at: eventAt,
      amount_kobo: amountKobo,
      service_class: serviceClass,
      raw: fields,
      line_no: lineNo,
      external_id: externalId,
    };
  }
}
