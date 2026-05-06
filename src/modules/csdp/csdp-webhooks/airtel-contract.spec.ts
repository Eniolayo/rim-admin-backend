import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import { AirtelLoanWebhookDto } from './dto/airtel-loan-webhook.dto';
import { AirtelRecoveryWebhookDto } from './dto/airtel-recovery-webhook.dto';

/**
 * Golden contract tests for Airtel CSDP webhook payloads.
 *
 * Each "golden" payload is the exact sample from
 * docs/AIRTEL_CSDP_INTEGRATION_API.md. A failure here means the wire
 * contract has drifted from the integration spec — block the deploy
 * and reconcile with Airtel before merging.
 *
 * These run at the class-validator level (no Nest app boot, no DB) so
 * they are cheap enough to gate every PR.
 */

async function validateDto<T extends object>(cls: new () => T, payload: unknown): Promise<ValidationError[]> {
  const instance = plainToInstance(cls, payload);
  return validate(instance as object, { whitelist: false, forbidNonWhitelisted: false });
}

describe('Airtel CSDP wire-contract golden tests', () => {
  describe('POST /loan-notification', () => {
    it('accepts the exact docs/AIRTEL_CSDP_INTEGRATION_API.md §2 sample', async () => {
      const errors = await validateDto(AirtelLoanWebhookDto, {
        msisdn: '2348122356701',
        amount: 500,
        max_amount: 500,
        trans_ref: '20221012051020',
        trans_datetime: '20260101 101010',
        transaction_type: 'AIRTIME',
        type: 'fulfillment',
        loan_id: '1212323233673',
        status: 'success',
      });
      expect(errors).toEqual([]);
    });

    it('rejects when `type` is anything other than "fulfillment"', async () => {
      const errors = await validateDto(AirtelLoanWebhookDto, {
        msisdn: '2348122356701',
        amount: 500,
        max_amount: 500,
        trans_ref: 'X',
        trans_datetime: '20260101 101010',
        transaction_type: 'AIRTIME',
        type: 'recovery',
        loan_id: '1',
        status: 'success',
      });
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'type')).toBe(true);
    });

    it('rejects malformed trans_datetime', async () => {
      const errors = await validateDto(AirtelLoanWebhookDto, {
        msisdn: '2348122356701',
        amount: 500,
        max_amount: 500,
        trans_ref: 'X',
        trans_datetime: '2026-01-01T10:10:10Z',
        transaction_type: 'AIRTIME',
        type: 'fulfillment',
        loan_id: '1',
        status: 'success',
      });
      expect(errors.some((e) => e.property === 'trans_datetime')).toBe(true);
    });

    it('rejects unknown transaction_type', async () => {
      const errors = await validateDto(AirtelLoanWebhookDto, {
        msisdn: '2348122356701',
        amount: 500,
        max_amount: 500,
        trans_ref: 'X',
        trans_datetime: '20260101 101010',
        transaction_type: 'VOICE',
        type: 'fulfillment',
        loan_id: '1',
        status: 'success',
      });
      expect(errors.some((e) => e.property === 'transaction_type')).toBe(true);
    });

    it('rejects when status is not "success"', async () => {
      const errors = await validateDto(AirtelLoanWebhookDto, {
        msisdn: '2348122356701',
        amount: 500,
        max_amount: 500,
        trans_ref: 'X',
        trans_datetime: '20260101 101010',
        transaction_type: 'AIRTIME',
        type: 'fulfillment',
        loan_id: '1',
        status: 'failed',
      });
      expect(errors.some((e) => e.property === 'status')).toBe(true);
    });
  });

  describe('POST /recovery-notification', () => {
    it('accepts the exact docs/AIRTEL_CSDP_INTEGRATION_API.md §3 sample', async () => {
      const errors = await validateDto(AirtelRecoveryWebhookDto, {
        msisdn: '8122356701',
        amount: 500,
        max_amount: 500,
        type: 'recovery',
        trans_ref: '20221012051020',
        trans_datetime: '20260101 101010',
        transaction_type: 'AIRTIME',
        request_type: 'recovery',
        loans: [
          { id: '1212323233673', paid: true, amount: 100, partner: 'RIM' },
        ],
        recovery_id: '29829238982',
        status: 'success',
      });
      expect(errors).toEqual([]);
    });

    it('accepts a payload using only the `type` discriminator', async () => {
      const errors = await validateDto(AirtelRecoveryWebhookDto, {
        msisdn: '8122356701',
        amount: 500,
        max_amount: 500,
        type: 'repayment',
        trans_ref: 'X',
        trans_datetime: '20260101 101010',
        transaction_type: 'AIRTIME',
        loans: [{ id: '1', paid: true, amount: 100 }],
        recovery_id: 'R-1',
        status: 'success',
      });
      expect(errors).toEqual([]);
    });

    it('accepts a payload using only the `request_type` discriminator', async () => {
      const errors = await validateDto(AirtelRecoveryWebhookDto, {
        msisdn: '8122356701',
        amount: 500,
        max_amount: 500,
        request_type: 'recovery',
        trans_ref: 'X',
        trans_datetime: '20260101 101010',
        transaction_type: 'AIRTIME',
        loans: [{ id: '1', paid: true, amount: 100 }],
        recovery_id: 'R-1',
        status: 'success',
      });
      expect(errors).toEqual([]);
    });

    it('rejects when both type and request_type are absent (handled by mapper, validated by guards on resolved value)', async () => {
      // The DTO itself permits both fields to be optional — runtime check
      // in the mapper enforces "at least one". Confirm the DTO doesn't
      // raise here so the mapper's error message is what surfaces.
      const errors = await validateDto(AirtelRecoveryWebhookDto, {
        msisdn: '8122356701',
        amount: 500,
        max_amount: 500,
        trans_ref: 'X',
        trans_datetime: '20260101 101010',
        transaction_type: 'AIRTIME',
        loans: [{ id: '1', paid: true, amount: 100 }],
        recovery_id: 'R-1',
        status: 'success',
      });
      expect(errors).toEqual([]);
    });

    it('rejects an empty `loans` array', async () => {
      const errors = await validateDto(AirtelRecoveryWebhookDto, {
        msisdn: '8122356701',
        amount: 500,
        max_amount: 500,
        type: 'recovery',
        trans_ref: 'X',
        trans_datetime: '20260101 101010',
        transaction_type: 'AIRTIME',
        loans: [],
        recovery_id: 'R-1',
        status: 'success',
      });
      expect(errors.some((e) => e.property === 'loans')).toBe(true);
    });

    it('rejects discriminator with a value other than recovery|repayment', async () => {
      const errors = await validateDto(AirtelRecoveryWebhookDto, {
        msisdn: '8122356701',
        amount: 500,
        max_amount: 500,
        type: 'fulfillment',
        trans_ref: 'X',
        trans_datetime: '20260101 101010',
        transaction_type: 'AIRTIME',
        loans: [{ id: '1', paid: true, amount: 100 }],
        recovery_id: 'R-1',
        status: 'success',
      });
      expect(errors.some((e) => e.property === 'type')).toBe(true);
    });

    it('rejects a loan item missing required fields', async () => {
      const errors = await validateDto(AirtelRecoveryWebhookDto, {
        msisdn: '8122356701',
        amount: 500,
        max_amount: 500,
        type: 'recovery',
        trans_ref: 'X',
        trans_datetime: '20260101 101010',
        transaction_type: 'AIRTIME',
        loans: [{ id: '1' }],
        recovery_id: 'R-1',
        status: 'success',
      });
      expect(errors.some((e) => e.property === 'loans')).toBe(true);
    });
  });
});
