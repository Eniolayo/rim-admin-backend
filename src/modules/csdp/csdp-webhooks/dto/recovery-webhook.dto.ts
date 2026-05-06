import {
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsNumberString,
  IsString,
} from 'class-validator';

export class RecoveryWebhookDto {
  @IsString()
  @IsNotEmpty()
  recovery_id: string;

  @IsString()
  @IsNotEmpty()
  msisdn: string;

  @IsNumberString()
  amount_naira: string;

  @IsDateString()
  recovered_at: string;

  @IsArray()
  loan_items: { loan_id: string; amount_applied_naira: string }[];
}
