import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { MulterModule } from '@nestjs/platform-express';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CsdpIngestBatch } from '../../../entities/csdp/csdp-ingest-batch.entity';
import { CsdpIngestRow } from '../../../entities/csdp/csdp-ingest-row.entity';
import { CsdpCdrRefill } from '../../../entities/csdp/csdp-cdr-refill.entity';
import { CsdpCdrSdp } from '../../../entities/csdp/csdp-cdr-sdp.entity';
import { CsdpLoan } from '../../../entities/csdp/csdp-loan.entity';
import { CsdpRecovery } from '../../../entities/csdp/csdp-recovery.entity';
import { CsdpRecoveryLoanItem } from '../../../entities/csdp/csdp-recovery-loan-item.entity';
import { CsdpSubscriber } from '../../../entities/csdp/csdp-subscriber.entity';
import { CsdpSubscriberDiscrepancyLog } from '../../../entities/csdp/csdp-subscriber-discrepancy-log.entity';
import { IngestService } from './ingest.service';
import { IngestController } from './ingest.controller';
import { IngestAdminController } from './ingest-admin.controller';
import { IngestProcessor } from './processors/ingest.processor';

@Module({
  imports: [
    // batchRepo (csdpHot) — used by IngestService for duplicate check + RECEIVED insert
    TypeOrmModule.forFeature([CsdpIngestBatch], 'csdpHot'),
    // all write repos (csdpBatch) — used by IngestProcessor
    TypeOrmModule.forFeature(
      [
        CsdpIngestBatch,
        CsdpIngestRow,
        CsdpCdrRefill,
        CsdpCdrSdp,
        CsdpLoan,
        CsdpRecovery,
        CsdpRecoveryLoanItem,
        CsdpSubscriber,
        CsdpSubscriberDiscrepancyLog,
      ],
      'csdpBatch',
    ),
    BullModule.registerQueue({ name: 'csdp-ingest' }),
    BullModule.registerQueue({ name: 'csdp-eligibility-linking' }),
    MulterModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        dest: cfg.get<string>('CSDP_INGEST_TMP_DIR') ?? '/tmp/csdp-ingest-uploads',
        limits: {
          fileSize: Number(cfg.get<string>('CSDP_INGEST_MAX_BYTES') ?? 1024 * 1024 * 1024),
        },
      }),
    }),
  ],
  controllers: [IngestController, IngestAdminController],
  providers: [IngestService, IngestProcessor],
  exports: [IngestService],
})
export class CsdpIngestModule {}
