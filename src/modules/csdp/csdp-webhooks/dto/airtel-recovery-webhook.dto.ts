import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * One entry in the Airtel recovery `loans` array.
 */
export class AirtelRecoveryLoanItemDto {
  /** Loan identifier (== `loan_id` from the original loan-notification). */
  @IsString()
  @IsNotEmpty()
  id: string;

  /** Whether the loan was paid by this recovery. */
  @IsBoolean()
  paid: boolean;

  /** Recovered amount for this loan (Naira, float). */
  @IsNumber()
  amount: number;

  /** Partner identifier (optional per spec). */
  @IsOptional()
  @IsString()
  partner?: string;
}

/**
 * Wire DTO for `POST /recovery-notification` from Airtel CSDP.
 *
 * See docs/AIRTEL_CSDP_INTEGRATION_API.md §3.
 *
 * **Discriminator field**: Airtel's spec is ambiguous between `type`
 * and `request_type`, with values `"recovery"` and `"repayment"` both
 * appearing in samples. We accept either field with either value to
 * stay forward-compatible until UAT confirms the canonical pair; at
 * least one must be present and resolve to a recognized value.
 */
export class AirtelRecoveryWebhookDto {
  /** Subscriber MSISDN in `234XXXXXXXXXX` format. */
  @IsString()
  @IsNotEmpty()
  msisdn: string;

  /** Amount recovered (Naira, float). */
  @IsNumber()
  amount: number;

  /** Same as `amount` per Airtel spec. */
  @IsNumber()
  max_amount: number;

  /** Unique transaction reference. */
  @IsString()
  @IsNotEmpty()
  trans_ref: string;

  /** Transaction date/time in `YYYYmmdd HHMMSS`. */
  @IsString()
  @Matches(/^\d{8}\s\d{6}$/, {
    message: 'trans_datetime must match "YYYYmmdd HHMMSS"',
  })
  trans_datetime: string;

  /** Transaction product (Airtel sample shows AIRTIME but spec allows others). */
  @IsString()
  @IsNotEmpty()
  transaction_type: string;

  /**
   * Discriminator. Some Airtel samples use `type`, others `request_type`.
   * Either field is accepted, validated to `"recovery"` | `"repayment"`.
   */
  @IsOptional()
  @IsIn(['recovery', 'repayment'])
  type?: 'recovery' | 'repayment';

  @IsOptional()
  @IsIn(['recovery', 'repayment'])
  request_type?: 'recovery' | 'repayment';

  /** Unique recovery identifier. */
  @IsString()
  @IsNotEmpty()
  recovery_id: string;

  /** Loan items recovered by this notification. */
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AirtelRecoveryLoanItemDto)
  loans: AirtelRecoveryLoanItemDto[];

  /** Always `"success"` per spec. */
  @IsIn(['success'])
  status: 'success';
}
