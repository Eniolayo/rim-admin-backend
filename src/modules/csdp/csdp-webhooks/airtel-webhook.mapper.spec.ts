import { AirtelWebhookMapper } from './airtel-webhook.mapper';
import { AirtelLoanWebhookDto } from './dto/airtel-loan-webhook.dto';
import { AirtelRecoveryWebhookDto } from './dto/airtel-recovery-webhook.dto';

describe('AirtelWebhookMapper', () => {
  const mapper = new AirtelWebhookMapper();

  describe('parseTransDatetime', () => {
    it('parses valid YYYYmmdd HHMMSS into ISO with Africa/Lagos offset', () => {
      expect(mapper.parseTransDatetime('20260101 101010')).toBe(
        '2026-01-01T10:10:10+01:00',
      );
    });

    it('returns null for malformed input', () => {
      expect(mapper.parseTransDatetime('2026-01-01 10:10:10')).toBeNull();
      expect(mapper.parseTransDatetime('20260101101010')).toBeNull();
      expect(mapper.parseTransDatetime('')).toBeNull();
    });
  });

  describe('mapLoan', () => {
    const sample: AirtelLoanWebhookDto = {
      msisdn: '2348122356701',
      amount: 500,
      max_amount: 500,
      trans_ref: '20221012051020',
      trans_datetime: '20260101 101010',
      transaction_type: 'AIRTIME',
      type: 'fulfillment',
      loan_id: '1212323233673',
      status: 'success',
    };

    it('maps the Airtel sample to the internal LoanWebhookDto shape', () => {
      const r = mapper.mapLoan(sample);
      expect(r).toEqual({
        loan_id: '1212323233673',
        msisdn: '2348122356701',
        vendor: 'AIRTEL',
        loan_type: 'AIRTIME',
        principal_naira: '500',
        repayable_naira: '500',
        status: 'ISSUED',
        trans_ref: '20221012051020',
        issued_at: '2026-01-01T10:10:10+01:00',
      });
    });

    it('canonicalizes 10-digit MSISDN to 234XXXXXXXXXX', () => {
      const r = mapper.mapLoan({ ...sample, msisdn: '8122356701' });
      expect(r.msisdn).toBe('2348122356701');
    });

    it('throws on invalid trans_datetime', () => {
      expect(() =>
        mapper.mapLoan({ ...sample, trans_datetime: 'garbage' }),
      ).toThrow(/invalid trans_datetime/);
    });
  });

  describe('mapRecovery', () => {
    const sample: AirtelRecoveryWebhookDto = {
      msisdn: '8122356701',
      amount: 500,
      max_amount: 500,
      trans_ref: '20221012051020',
      trans_datetime: '20260101 101010',
      transaction_type: 'AIRTIME',
      request_type: 'recovery',
      loans: [{ id: '1212323233673', paid: true, amount: 100, partner: 'RIM' }],
      recovery_id: '29829238982',
      status: 'success',
    };

    it('maps the Airtel sample to the internal RecoveryWebhookDto shape', () => {
      const r = mapper.mapRecovery(sample);
      expect(r).toEqual({
        recovery_id: '29829238982',
        msisdn: '2348122356701',
        amount_naira: '500',
        recovered_at: '2026-01-01T10:10:10+01:00',
        loan_items: [
          { loan_id: '1212323233673', amount_applied_naira: '100' },
        ],
      });
    });

    it('accepts `type` instead of `request_type` as the discriminator', () => {
      const r = mapper.mapRecovery({
        ...sample,
        request_type: undefined,
        type: 'repayment',
      });
      expect(r.recovery_id).toBe('29829238982');
    });

    it('throws when neither `type` nor `request_type` is present', () => {
      expect(() =>
        mapper.mapRecovery({
          ...sample,
          type: undefined,
          request_type: undefined,
        }),
      ).toThrow(/missing discriminator/);
    });

    it('maps multi-loan recovery items preserving order', () => {
      const r = mapper.mapRecovery({
        ...sample,
        loans: [
          { id: 'A', paid: true, amount: 50 },
          { id: 'B', paid: false, amount: 25 },
        ],
      });
      expect(r.loan_items).toEqual([
        { loan_id: 'A', amount_applied_naira: '50' },
        { loan_id: 'B', amount_applied_naira: '25' },
      ]);
    });
  });
});
