import { Injectable } from '@nestjs/common';
import { toE164Nigerian } from '../../../common/utils/phone.utils';
import { AirtelLoanWebhookDto } from './dto/airtel-loan-webhook.dto';
import { AirtelRecoveryWebhookDto } from './dto/airtel-recovery-webhook.dto';
import { LoanWebhookDto } from './dto/loan-webhook.dto';
import { RecoveryWebhookDto } from './dto/recovery-webhook.dto';

/**
 * Translates Airtel-shape webhook payloads to the internal DTOs the
 * Phase 2 processors already consume. Keeps the wire contract and the
 * processing pipeline decoupled so either side can evolve
 * independently.
 *
 * MSISDN is canonicalized to `234XXXXXXXXXX` on the way through; the
 * `csdp_loan` / `csdp_recovery` write-side DB CHECK constraint rejects
 * any other form.
 */
@Injectable()
export class AirtelWebhookMapper {
  /**
   * Parses Airtel's `YYYYmmdd HHMMSS` (space-separated, treated as
   * Africa/Lagos local time, which is UTC+01:00 with no DST) into an
   * ISO-8601 string with explicit offset. Returns `null` for malformed
   * input — the caller treats null as a validation failure.
   */
  parseTransDatetime(input: string): string | null {
    const m = /^(\d{4})(\d{2})(\d{2})\s(\d{2})(\d{2})(\d{2})$/.exec(input);
    if (!m) return null;
    const [, yyyy, MM, dd, hh, mm, ss] = m;
    return `${yyyy}-${MM}-${dd}T${hh}:${mm}:${ss}+01:00`;
  }

  mapLoan(dto: AirtelLoanWebhookDto): LoanWebhookDto {
    const msisdn = toE164Nigerian(dto.msisdn);
    if (!msisdn) throw new Error(`invalid msisdn: ${dto.msisdn}`);

    const issuedAt = this.parseTransDatetime(dto.trans_datetime);
    if (!issuedAt) throw new Error(`invalid trans_datetime: ${dto.trans_datetime}`);

    // Airtel sends a single `amount`; `max_amount` is documented as the
    // same value. Use it as `repayable_naira` so the Phase 2 processor
    // sees a non-null repayable.
    const principal = dto.amount.toString();
    const repayable = dto.max_amount.toString();

    return {
      loan_id: dto.loan_id,
      msisdn,
      vendor: 'AIRTEL',
      loan_type: dto.transaction_type,
      principal_naira: principal,
      repayable_naira: repayable,
      status: 'ISSUED',
      trans_ref: dto.trans_ref,
      issued_at: issuedAt,
    };
  }

  mapRecovery(dto: AirtelRecoveryWebhookDto): RecoveryWebhookDto {
    const msisdn = toE164Nigerian(dto.msisdn);
    if (!msisdn) throw new Error(`invalid msisdn: ${dto.msisdn}`);

    const recoveredAt = this.parseTransDatetime(dto.trans_datetime);
    if (!recoveredAt) throw new Error(`invalid trans_datetime: ${dto.trans_datetime}`);

    // `type` and `request_type` are accepted interchangeably; resolve
    // a single discriminator value for downstream observability. The
    // DTO validator already constrained both to recovery|repayment.
    const discriminator = dto.type ?? dto.request_type;
    if (!discriminator) {
      throw new Error('missing discriminator: either `type` or `request_type` is required');
    }

    return {
      recovery_id: dto.recovery_id,
      msisdn,
      amount_naira: dto.amount.toString(),
      recovered_at: recoveredAt,
      loan_items: dto.loans.map((l) => ({
        loan_id: l.id,
        amount_applied_naira: l.amount.toString(),
      })),
    };
  }
}
