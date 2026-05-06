import { msisdnTransformer } from './msisdn.transformer';

describe('msisdnTransformer', () => {
  describe('to (write to DB)', () => {
    it('normalises local 11-digit format to E.164 (no +)', () => {
      expect(msisdnTransformer.to('07030278896')).toBe('2347030278896');
    });

    it('accepts already-normalised 234-prefixed 13-digit input', () => {
      expect(msisdnTransformer.to('2347030278896')).toBe('2347030278896');
    });

    it('accepts +234 14-char input and strips the +', () => {
      expect(msisdnTransformer.to('+2347030278896')).toBe('2347030278896');
    });

    it('throws on garbage input that cannot be normalised', () => {
      // Phase 1: transformer is strict — pairs with the per-column DB CHECK.
      // Any value that does not normalise to ^234\d{10}$ must fail loudly so
      // we never persist a non-canonical MSISDN.
      expect(() => msisdnTransformer.to!('abc')).toThrow(/msisdn/i);
    });

    it('returns null for null input', () => {
      expect(msisdnTransformer.to(null)).toBeNull();
    });

    it('returns undefined for undefined input', () => {
      expect(msisdnTransformer.to(undefined)).toBeUndefined();
    });
  });

  describe('from (read from DB)', () => {
    it('returns the stored string as-is', () => {
      expect(msisdnTransformer.from('2347030278896')).toBe('2347030278896');
    });

    it('returns null for null', () => {
      expect(msisdnTransformer.from(null)).toBeNull();
    });

    it('returns null for undefined', () => {
      expect(msisdnTransformer.from(undefined)).toBeNull();
    });
  });
});
