import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

export interface CachedProfileDecision {
  responseLimitNaira: string;
  winner: string;
  decisionMode: string;
  teamweeLimitNaira: string | null;
  rimLimitNaira: string | null;
}

/** A cached decision is reusable for this long. Profile traffic is keyed by
 *  trans_ref (Airtel guarantees uniqueness per request); 24 h is a generous
 *  window that comfortably covers any partner retry budget. */
const CACHE_WINDOW_HOURS = 24;

/**
 * Profile idempotency lookup keyed by trans_ref. The `csdp_eligibility_log`
 * unique constraint on trans_ref guarantees at most one decision per
 * partner request; this service surfaces that decision so a replay of the
 * same trans_ref returns the same `message` value rather than recomputing.
 */
@Injectable()
export class ProfileIdempotencyService {
  private readonly logger = new Logger(ProfileIdempotencyService.name);

  constructor(
    @InjectDataSource('csdpBatch')
    private readonly dataSource: DataSource,
  ) {}

  async lookup(transRef: string): Promise<CachedProfileDecision | null> {
    const rows: Array<{
      winner: string;
      decision_mode: string;
      teamwee_limit_naira: string | null;
      rim_limit_naira: string | null;
      final_limit_naira: number | null;
    }> = await this.dataSource.query(
      `SELECT winner, decision_mode, teamwee_limit_naira, rim_limit_naira, final_limit_naira
       FROM csdp_eligibility_log
       WHERE trans_ref = $1
         AND requested_at > NOW() - ($2 || ' hours')::interval
       ORDER BY requested_at DESC
       LIMIT 1`,
      [transRef, CACHE_WINDOW_HOURS],
    );

    const row = rows?.[0];
    if (!row) return null;

    return {
      responseLimitNaira: deriveResponseLimit(row),
      winner: row.winner,
      decisionMode: row.decision_mode,
      teamweeLimitNaira: row.teamwee_limit_naira,
      rimLimitNaira: row.rim_limit_naira,
    };
  }
}

function deriveResponseLimit(row: {
  winner: string;
  teamwee_limit_naira: string | null;
  rim_limit_naira: string | null;
  final_limit_naira: number | null;
}): string {
  switch (row.winner) {
    case 'TEAMWEE':
      return row.teamwee_limit_naira ?? '0';
    case 'RIM':
      return row.rim_limit_naira ?? String(row.final_limit_naira ?? 0);
    case 'STUB':
    case 'FALLBACK':
    default:
      return '0';
  }
}
