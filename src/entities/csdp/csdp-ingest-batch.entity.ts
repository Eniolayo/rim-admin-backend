import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity({ name: 'csdp_ingest_batch' })
export class CsdpIngestBatch {
  @PrimaryColumn({ type: 'uuid' })
  id: string;

  /** refill | sdp | vendor:avyra | vendor:erl | vendor:fonyou */
  @Column({ type: 'varchar', length: 32 })
  source: string;

  @Column({ name: 'file_date', type: 'date' })
  fileDate: string;

  @Index({ unique: true })
  @Column({ name: 'file_hash', type: 'varchar', length: 64 })
  fileHash: string;

  /** RECEIVED | PARSING | PARSED | FAILED */
  @Column({ type: 'varchar', length: 16 })
  status: string;

  @Column({ name: 'storage_uri', type: 'varchar', length: 512 })
  storageUri: string;

  @Column({ name: 'rows_total', type: 'int', default: 0 })
  rowsTotal: number;

  @Column({ name: 'rows_ok', type: 'int', default: 0 })
  rowsOk: number;

  @Column({ name: 'rows_rejected', type: 'int', default: 0 })
  rowsRejected: number;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'parsed_at', type: 'timestamp', nullable: true })
  parsedAt: Date | null;
}
