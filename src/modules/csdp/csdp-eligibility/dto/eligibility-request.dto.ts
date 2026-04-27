import { IsString, IsNotEmpty, IsIn } from 'class-validator';

export class EligibilityRequestDto {
  @IsString()
  @IsNotEmpty()
  msisdn: string;

  @IsString()
  @IsNotEmpty()
  trans_ref: string;

  @IsString()
  da_kobo: string; // bigint value transmitted as string

  @IsIn(['AIRTIME', 'DATA', 'TALKTIME'])
  loan_type: 'AIRTIME' | 'DATA' | 'TALKTIME';
}
