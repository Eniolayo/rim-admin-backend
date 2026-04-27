import { Column, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Unique('uq_ingest_row_source_date_ext', ['source', 'fileDate', 'externalId'])
@Entity({ name: 'csdp_ingest_row' })
export class CsdpIngestRow {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id' })
  id: string;

  @Index()
  @Column({ name: 'batch_id', type: 'uuid' })
  batchId: string;

  @Column({ type: 'varchar', length: 32 })
  source: string;

  @Column({ name: 'file_date', type: 'date' })
  fileDate: string;

  @Column({ name: 'external_id', type: 'varchar', length: 128 })
  externalId: string;

  @Column({ name: 'line_no', type: 'int' })
  lineNo: number;

  @Column({ name: 'raw_line', type: 'text' })
  rawLine: string;

  @Column({ type: 'jsonb', nullable: true })
  parsed: Record<string, any> | null;

  /** OK | REJECTED */
  @Column({ type: 'varchar', length: 16 })
  status: string;

  @Column({ name: 'error_reason', type: 'varchar', length: 255, nullable: true })
  errorReason: string | null;
}
