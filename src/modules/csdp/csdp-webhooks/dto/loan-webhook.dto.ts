import {
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
} from 'class-validator';

export class LoanWebhookDto {
  @IsString()
  @IsNotEmpty()
  loan_id: string;

  @IsString()
  @IsNotEmpty()
  msisdn: string;

  @IsString()
  vendor: string; // AVYRA | ERL | FONYOU | OTHER

  @IsIn(['AIRTIME', 'DATA', 'TALKTIME'])
  loan_type: 'AIRTIME' | 'DATA' | 'TALKTIME';

  @IsNumberString()
  principal_naira: string;

  @IsNumberString()
  repayable_naira: string;

  @IsIn(['ISSUED', 'RECOVERED', 'DEFAULTED', 'CANCELLED'])
  status: string;

  @IsString()
  @IsOptional()
  trans_ref?: string;

  @IsDateString()
  issued_at: string;

  @IsDateString()
  @IsOptional()
  recovered_at?: string;
}
