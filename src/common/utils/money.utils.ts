/**
 * CSDP money helpers.
 *
 * Storage standard: amounts persist as naira (numeric(14,2)) — TypeORM maps
 * numeric to a JS string, so internal services pass naira values around as
 * strings (e.g. "1000.00").
 *
 * The single intentional kobo persistence is `csdp_eligibility_log.da_kobo`,
 * which is the verbatim audit of the inbound `/profile?da=...` query param.
 *
 * All helpers operate on string inputs and use BigInt internally to preserve
 * precision past Number.MAX_SAFE_INTEGER.
 */

/** Convert a kobo integer (string | number | bigint) → naira string with 2 decimals. */
export function koboToNaira(kobo: string | number | bigint): string {
  const n = BigInt(typeof kobo === 'number' ? Math.trunc(kobo) : kobo);
  const negative = n < 0n;
  const abs = negative ? -n : n;
  const whole = abs / 100n;
  const fraction = abs % 100n;
  const sign = negative ? '-' : '';
  return `${sign}${whole.toString()}.${fraction.toString().padStart(2, '0')}`;
}

/** Convert a naira string (e.g. "1000", "1000.5", "1000.50") → kobo integer string. */
export function nairaToKobo(naira: string | number): string {
  const s = String(naira).trim();
  const negative = s.startsWith('-');
  const unsigned = negative ? s.slice(1) : s;
  const [whole, frac = ''] = unsigned.split('.');
  const fracPadded = (frac + '00').slice(0, 2);
  const kobo = BigInt(whole || '0') * 100n + BigInt(fracPadded || '0');
  return `${negative && kobo !== 0n ? '-' : ''}${kobo.toString()}`;
}
