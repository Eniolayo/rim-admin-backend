export interface TeamweeEligibilityRequest {
  msisdn: string; // E.164 234XXXXXXXXXX
  transRef: string;
  /**
   * Raw kobo string forwarded verbatim from Airtel's `?da=...`.
   * Teamwee accepts kobo on input, so we pass it straight through —
   * no naira round-trip.
   */
  daKobo: string | null;
  loanType: 'AIRTIME' | 'DATA' | 'TALKTIME';
}

export interface TeamweeEligibilityResponse {
  /** Limit in naira (string). 0 (or "0") means deny. */
  limitNaira: string;
  rawResponse: unknown; // for logging
  latencyMs: number;
}
