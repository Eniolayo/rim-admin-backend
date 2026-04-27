export interface TeamweeEligibilityRequest {
  msisdn: string; // E.164 234XXXXXXXXXX
  transRef: string;
  daKobo: bigint | string;
  loanType: 'AIRTIME' | 'DATA' | 'TALKTIME';
}

export interface TeamweeEligibilityResponse {
  limitKobo: bigint; // 0 means deny
  rawResponse: unknown; // for logging
  latencyMs: number;
}
