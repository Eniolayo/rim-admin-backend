import { IsIn, IsNumberString, IsOptional, IsString, IsNotEmpty } from 'class-validator';

/**
 * Wire contract for `GET /profile`.
 *
 * Mirrors the TIMWETECH-facing query string exactly:
 *   ?msisdn=2348...&da=50000&trans_ref=...&type=AIRTIME
 *
 * `da` is the only kobo value we accept; everything internal converts to naira
 * at the controller boundary. It is marked optional so a caller that omits it
 * still gets logged with `da_kobo = NULL` rather than rejected here.
 */
export class EligibilityRequestDto {
  @IsString()
  @IsNotEmpty()
  msisdn: string;

  @IsString()
  @IsNotEmpty()
  trans_ref: string;

  @IsOptional()
  @IsNumberString()
  da?: string;

  @IsIn(['AIRTIME', 'DATA', 'TALKTIME'])
  type: 'AIRTIME' | 'DATA' | 'TALKTIME';
}
