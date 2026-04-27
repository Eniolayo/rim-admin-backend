import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CsdpWebhookInboundLog } from '../../../../entities/csdp/csdp-webhook-inbound-log.entity';

@Injectable()
export class InboundLogService {
  constructor(
    @InjectRepository(CsdpWebhookInboundLog, 'csdpHot')
    private readonly repo: Repository<CsdpWebhookInboundLog>,
  ) {}

  /**
   * Records an inbound webhook, deduplicating on dedupe_key.
   * Uses INSERT ... ON CONFLICT (dedupe_key) DO NOTHING RETURNING id.
   * If the row already existed, isDuplicate is true and the existing id is returned.
   */
  async record(
    kind: 'loan' | 'recovery',
    dedupeKey: string,
    body: any,
    headers: Record<string, any>,
  ): Promise<{ id: string; isDuplicate: boolean }> {
    const result: Array<{ id: string }> = await this.repo.query(
      `INSERT INTO csdp_webhook_inbound_log (id, kind, dedupe_key, body, headers)
       VALUES (gen_random_uuid(), $1, $2, $3::jsonb, $4::jsonb)
       ON CONFLICT (dedupe_key) DO NOTHING
       RETURNING id`,
      [kind, dedupeKey, JSON.stringify(body), JSON.stringify(headers)],
    );

    if (result.length > 0) {
      return { id: result[0].id, isDuplicate: false };
    }

    // Row already existed — fetch the existing id
    const existing: Array<{ id: string }> = await this.repo.query(
      `SELECT id FROM csdp_webhook_inbound_log WHERE dedupe_key = $1`,
      [dedupeKey],
    );

    return { id: existing[0].id, isDuplicate: true };
  }
}
