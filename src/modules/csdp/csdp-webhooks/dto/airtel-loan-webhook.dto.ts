import {
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsString,
  Matches,
} from 'class-validator';

/**
 * Wire DTO for `POST /loan-notification` from Airtel CSDP.
 *
 * See docs/AIRTEL_CSDP_INTEGRATION_API.md §2 — fired when a loan is given
 * to a subscriber. Field names and casing match the Airtel spec
 * verbatim; the mapper translates to the internal `LoanWebhookDto`
 * before the BullMQ job is enqueued.
 *
 * The `Authorization: ApiKey {api-key}` header is enforced upstream by
 * `AirtelApiKeyGuard`.
 */
export class AirtelLoanWebhookDto {
  /** Subscriber MSISDN in `234XXXXXXXXXX` format. */
  @IsString()
  @IsNotEmpty()
  msisdn: string;

  /** Amount borrowed (Naira, float). */
  @IsNumber()
  amount: number;

  /** Same as `amount` per Airtel spec. */
  @IsNumber()
  max_amount: number;

  /** Unique transaction reference (== Profile `trans_ref`). */
  @IsString()
  @IsNotEmpty()
  trans_ref: string;

  /**
   * Transaction date/time in `YYYYmmdd HHMMSS` (space-separated, e.g.
   * `"20260101 101010"`). Parsed to ISO-8601 by the mapper.
   */
  @IsString()
  @Matches(/^\d{8}\s\d{6}$/, {
    message: 'trans_datetime must match "YYYYmmdd HHMMSS"',
  })
  trans_datetime: string;

  /** Transaction product. */
  @IsIn(['AIRTIME', 'DATA', 'TALKTIME'])
  transaction_type: 'AIRTIME' | 'DATA' | 'TALKTIME';

  /** Discriminator — must be exactly `"fulfillment"` on this endpoint. */
  @IsIn(['fulfillment'])
  type: 'fulfillment';

  /** Unique loan identifier. */
  @IsString()
  @IsNotEmpty()
  loan_id: string;

  /** Always `"success"` per spec. */
  @IsIn(['success'])
  status: 'success';
}
