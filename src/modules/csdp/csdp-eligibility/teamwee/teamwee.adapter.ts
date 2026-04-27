import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import type { Histogram } from 'prom-client';
import { TeamweeUnavailableError } from './teamwee.errors';
import {
  TeamweeEligibilityRequest,
  TeamweeEligibilityResponse,
} from './teamwee.types';
import { CSDP_METRICS } from '../../csdp-core/metrics/csdp-metrics.module';

@Injectable()
export class TeamweeAdapter {
  private readonly logger = new Logger(TeamweeAdapter.name);

  private readonly baseUrl: string | undefined;
  private readonly apiKey: string | undefined;
  private readonly timeoutMs: number;
  private readonly cbThreshold: number;
  private readonly cbResetMs: number;

  // Inline circuit-breaker state
  private failureCount = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private openedAt = 0;
  private windowStart = Date.now();

  constructor(
    private readonly config: ConfigService,
    @InjectMetric(CSDP_METRICS.teamweeLatencyMs)
    private readonly latencyHistogram: Histogram<string>,
  ) {
    this.baseUrl = this.config.get<string>('TEAMWEE_BASE_URL');
    this.apiKey = this.config.get<string>('TEAMWEE_API_KEY');
    this.timeoutMs = this.config.get<number>('TEAMWEE_TIMEOUT_MS') ?? 800;
    this.cbThreshold = this.config.get<number>('TEAMWEE_CB_THRESHOLD') ?? 5;
    this.cbResetMs = this.config.get<number>('TEAMWEE_CB_RESET_MS') ?? 30000;
  }

  async checkEligibility(
    req: TeamweeEligibilityRequest,
  ): Promise<TeamweeEligibilityResponse> {
    if (!this.baseUrl || !this.apiKey) {
      throw new TeamweeUnavailableError(
        'connection',
        'TEAMWEE_BASE_URL not configured',
      );
    }

    // Circuit-breaker guard
    this.evaluateCircuit();

    const start = Date.now();
    let error: TeamweeUnavailableError | undefined;
    let result: TeamweeEligibilityResponse | undefined;

    try {
      result = await this.doRequest(req, false);
      this.onSuccess();
    } catch (err) {
      if (err instanceof TeamweeUnavailableError) {
        error = err;
        this.onFailure(err);
      } else {
        error = new TeamweeUnavailableError('connection', String(err));
        this.onFailure(error);
      }
    } finally {
      const latencyMs = Date.now() - start;
      this.latencyHistogram.observe(latencyMs);
    }

    if (error) throw error;
    return result!;
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  private evaluateCircuit(): void {
    if (this.state === 'OPEN') {
      if (Date.now() - this.openedAt < this.cbResetMs) {
        throw new TeamweeUnavailableError('circuit_open');
      }
      // Reset window has elapsed → probe
      this.state = 'HALF_OPEN';
      this.logger.warn('TeamweeAdapter circuit → HALF_OPEN (probing)');
    }
  }

  private onSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      this.state = 'CLOSED';
      this.failureCount = 0;
      this.windowStart = Date.now();
      this.logger.log('TeamweeAdapter circuit → CLOSED (probe succeeded)');
    }
    // In CLOSED state just leave counter as-is; reset window on success to
    // be generous (successive successes keep window fresh).
  }

  private onFailure(err: TeamweeUnavailableError): void {
    // Don't count circuit_open itself as a fresh failure
    if (err.cause === 'circuit_open') return;

    if (this.state === 'HALF_OPEN') {
      this.state = 'OPEN';
      this.openedAt = Date.now();
      this.logger.warn('TeamweeAdapter circuit → OPEN (probe failed)');
      return;
    }

    // Reset failure window if cbResetMs has passed since windowStart
    if (Date.now() - this.windowStart >= this.cbResetMs) {
      this.failureCount = 0;
      this.windowStart = Date.now();
    }

    this.failureCount++;
    if (this.failureCount >= this.cbThreshold) {
      this.state = 'OPEN';
      this.openedAt = Date.now();
      this.logger.warn(
        `TeamweeAdapter circuit → OPEN (${this.failureCount} failures in window)`,
      );
    }
  }

  private async doRequest(
    req: TeamweeEligibilityRequest,
    isRetry: boolean,
  ): Promise<TeamweeEligibilityResponse> {
    const start = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    // NOTE: /eligibility is a placeholder path — real path TBD from Teamwee API docs.
    const url = `${this.baseUrl}/eligibility`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'X-Trans-Ref': req.transRef,
        },
        body: JSON.stringify({
          msisdn: req.msisdn,
          transRef: req.transRef,
          daKobo: String(req.daKobo),
          loanType: req.loanType,
        }),
      });
    } catch (err: unknown) {
      clearTimeout(timer);
      // AbortController fires a DOMException with name 'AbortError'
      const isAbort =
        err instanceof Error &&
        (err.name === 'AbortError' || err.name === 'TimeoutError');
      if (isAbort) {
        throw new TeamweeUnavailableError('timeout');
      }
      // Connection error — retry once (but not on retry itself)
      if (!isRetry) {
        this.logger.warn(
          `TeamweeAdapter connection error, retrying once: ${String(err)}`,
        );
        return this.doRequest(req, true);
      }
      throw new TeamweeUnavailableError('connection', String(err));
    }

    clearTimeout(timer);
    const latencyMs = Date.now() - start;

    if (response.status >= 500) {
      throw new TeamweeUnavailableError('http_5xx', `HTTP ${response.status}`);
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new TeamweeUnavailableError('malformed', 'Response is not JSON');
    }

    // NOTE: expected schema { limit_kobo: number | string } — placeholder,
    // real field names TBD from Teamwee API docs.
    const raw = body as Record<string, unknown>;
    const limitRaw = raw['limit_kobo'];
    if (limitRaw === undefined || limitRaw === null) {
      throw new TeamweeUnavailableError(
        'malformed',
        'Missing limit_kobo in response',
      );
    }
    const limitNum =
      typeof limitRaw === 'string' ? Number(limitRaw) : Number(limitRaw);
    if (!Number.isFinite(limitNum)) {
      throw new TeamweeUnavailableError(
        'malformed',
        `Non-numeric limit_kobo: ${String(limitRaw)}`,
      );
    }

    return {
      limitKobo: BigInt(Math.round(limitNum)),
      rawResponse: body,
      latencyMs,
    };
  }
}
