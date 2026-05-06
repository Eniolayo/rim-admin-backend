import { normalizeMsisdn, normalizeNigerianPhone, toE164Nigerian, MSISDN_REGEX } from './phone.utils';

describe('normalizeNigerianPhone', () => {
  it('passes through canonical local format', () => {
    expect(normalizeNigerianPhone('07030278896')).toBe('07030278896');
  });

  it('converts +234 international form to local', () => {
    expect(normalizeNigerianPhone('+2347030278896')).toBe('07030278896');
  });

  it('converts 234 international form to local', () => {
    expect(normalizeNigerianPhone('2347030278896')).toBe('07030278896');
  });

  it('handles 10-digit local number without leading 0', () => {
    expect(normalizeNigerianPhone('7030278896')).toBe('07030278896');
  });

  it('returns null for empty / null / undefined', () => {
    expect(normalizeNigerianPhone(null)).toBeNull();
    expect(normalizeNigerianPhone(undefined)).toBeNull();
    expect(normalizeNigerianPhone('')).toBeNull();
  });
});

describe('toE164Nigerian', () => {
  it('returns 234XXXXXXXXXX for valid local input', () => {
    expect(toE164Nigerian('07030278896')).toBe('2347030278896');
  });

  it('returns 234XXXXXXXXXX for +234 input', () => {
    expect(toE164Nigerian('+2347030278896')).toBe('2347030278896');
  });

  it('returns null for un-normalisable input', () => {
    expect(toE164Nigerian('abc')).toBeNull();
    expect(toE164Nigerian('123')).toBeNull();
  });
});

describe('normalizeMsisdn (canonical CSDP form 234XXXXXXXXXX)', () => {
  it('returns 234XXXXXXXXXX for the various accepted inputs', () => {
    expect(normalizeMsisdn('07030278896')).toBe('2347030278896');
    expect(normalizeMsisdn('2347030278896')).toBe('2347030278896');
    expect(normalizeMsisdn('+2347030278896')).toBe('2347030278896');
    expect(normalizeMsisdn(' 070-3027-8896 ')).toBe('2347030278896');
    expect(normalizeMsisdn('7030278896')).toBe('2347030278896');
  });

  it('throws on null / undefined / empty', () => {
    expect(() => normalizeMsisdn(null as unknown as string)).toThrow(/msisdn/i);
    expect(() => normalizeMsisdn(undefined as unknown as string)).toThrow(/msisdn/i);
    expect(() => normalizeMsisdn('')).toThrow(/msisdn/i);
  });

  it('throws on numbers that do not normalise to a 13-digit 234XXXXXXXXXX', () => {
    expect(() => normalizeMsisdn('123')).toThrow(/msisdn/i);
    expect(() => normalizeMsisdn('+1 415 555 1212')).toThrow(/msisdn/i);
    // Too short Nigerian-looking input
    expect(() => normalizeMsisdn('234703027889')).toThrow(/msisdn/i);
  });

  it('output always matches MSISDN_REGEX', () => {
    const ok = normalizeMsisdn('+2347030278896');
    expect(MSISDN_REGEX.test(ok)).toBe(true);
  });
});

describe('MSISDN_REGEX', () => {
  it('accepts only 234 followed by 10 digits', () => {
    expect(MSISDN_REGEX.test('2347030278896')).toBe(true);
    expect(MSISDN_REGEX.test('234703027889')).toBe(false); // 12 digits
    expect(MSISDN_REGEX.test('23470302788960')).toBe(false); // 14 digits
    expect(MSISDN_REGEX.test('1347030278896')).toBe(false);
    expect(MSISDN_REGEX.test('234703027889a')).toBe(false);
  });
});
