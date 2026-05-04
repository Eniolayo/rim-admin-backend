import { toE164Nigerian } from '../../../../common/utils/phone.utils';
import { readCsv } from './csv.reader';

export interface ActivationRow {
  msisdn: string;
  /** Date-only string `YYYY-MM-DD` — matches the `date` column type on csdp_subscriber. */
  activated_at: string;
  service_class_id: number | null;
  raw: Record<string, string>;
  line_no: number;
  external_id: string;
}

export interface ActivationRowError {
  error: string;
  raw: string;
  line_no: number;
}

const REQUIRED_HEADERS = ['servedmsisdn', 'accountactivateddate'];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Parses an Airtel activation CSV file (`ACTIVATION_DATE_OF_SUBSCRIBER.csv`)
 * streamingly.
 *
 * Required headers: servedmsisdn, accountactivateddate.
 * Optional: serviceclassid (parsed if present).
 *
 * `accountactivateddate` is `YYYY-MM-DD` — date-only, no timezone ambiguity.
 * MSISDN is normalized via `toE164Nigerian`; rows that fail to normalize or
 * have an invalid date are rejected.
 */
export async function* parseActivation(
  filePath: string,
): AsyncGenerator<ActivationRow | ActivationRowError> {
  const iterator = readCsv(filePath, { requiredHeaders: REQUIRED_HEADERS });

  for await (const row of iterator) {
    const lineNo = row.line_no;
    const fields = row.fields;

    const rawMsisdn = fields['servedmsisdn'];
    const dateStr = fields['accountactivateddate'];
    const serviceClassStr = fields['serviceclassid'];

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
      yield { error: 'empty accountactivateddate', raw: rawLine, line_no: lineNo };
      continue;
    }
    if (!DATE_RE.test(dateStr)) {
      yield {
        error: `invalid accountactivateddate (expected YYYY-MM-DD): ${dateStr}`,
        raw: rawLine,
        line_no: lineNo,
      };
      continue;
    }
    // Sanity check: actual valid date.
    const probe = new Date(`${dateStr}T00:00:00Z`);
    if (isNaN(probe.getTime())) {
      yield {
        error: `invalid accountactivateddate: ${dateStr}`,
        raw: rawLine,
        line_no: lineNo,
      };
      continue;
    }

    let serviceClassId: number | null = null;
    if (serviceClassStr) {
      const parsed = parseInt(serviceClassStr, 10);
      if (isNaN(parsed)) {
        yield {
          error: `invalid serviceclassid: ${serviceClassStr}`,
          raw: rawLine,
          line_no: lineNo,
        };
        continue;
      }
      serviceClassId = parsed;
    }

    yield {
      msisdn,
      activated_at: dateStr,
      service_class_id: serviceClassId,
      raw: fields,
      line_no: lineNo,
      external_id: `${msisdn}|${dateStr}`,
    };
  }
}
