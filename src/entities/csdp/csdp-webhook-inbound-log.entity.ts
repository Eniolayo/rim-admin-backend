import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity({ name: 'csdp_webhook_inbound_log' })
export class CsdpWebhookInboundLog {
  @PrimaryColumn({ type: 'uuid' })
  id: string;

  /** loan | recovery */
  @Column({ type: 'varchar', length: 16 })
  kind: string;

  @Index({ unique: true })
  @Column({ name: 'dedupe_key', type: 'varchar', length: 128 })
  dedupeKey: string;

  @Column({ type: 'jsonb' })
  body: Record<string, any>;

  @Column({ type: 'jsonb' })
  headers: Record<string, any>;

  @CreateDateColumn({ name: 'received_at' })
  receivedAt: Date;
}
