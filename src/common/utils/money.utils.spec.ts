import { koboToNaira, nairaToKobo } from './money.utils';

describe('money.utils', () => {
  describe('koboToNaira', () => {
    it('converts whole-naira kobo values', () => {
      expect(koboToNaira('100000')).toBe('1000.00');
      expect(koboToNaira(100000)).toBe('1000.00');
      expect(koboToNaira(100000n)).toBe('1000.00');
    });

    it('converts sub-naira kobo values with padding', () => {
      expect(koboToNaira('5')).toBe('0.05');
      expect(koboToNaira('50')).toBe('0.50');
      expect(koboToNaira('99')).toBe('0.99');
    });

    it('handles zero', () => {
      expect(koboToNaira('0')).toBe('0.00');
    });

    it('handles negative kobo', () => {
      expect(koboToNaira('-12345')).toBe('-123.45');
    });

    it('survives values past Number.MAX_SAFE_INTEGER', () => {
      const big = '99999999999999999999';
      expect(koboToNaira(big)).toBe('999999999999999999.99');
    });
  });

  describe('nairaToKobo', () => {
    it('converts whole-naira strings', () => {
      expect(nairaToKobo('1000')).toBe('100000');
      expect(nairaToKobo('0')).toBe('0');
    });

    it('converts decimal-naira strings, padding short fractions', () => {
      expect(nairaToKobo('1000.5')).toBe('100050');
      expect(nairaToKobo('1000.50')).toBe('100050');
      expect(nairaToKobo('1000.05')).toBe('100005');
    });

    it('truncates fractions beyond 2 decimal places (does not round)', () => {
      expect(nairaToKobo('1.999')).toBe('199');
    });

    it('handles negative naira', () => {
      expect(nairaToKobo('-12.34')).toBe('-1234');
    });
  });

  describe('round-trip', () => {
    it('preserves whole-naira values', () => {
      expect(koboToNaira(nairaToKobo('1234'))).toBe('1234.00');
    });

    it('preserves 2-decimal-place naira values', () => {
      expect(koboToNaira(nairaToKobo('1234.56'))).toBe('1234.56');
    });
  });
});
