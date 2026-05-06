import { Logger } from '@nestjs/common';
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter } from 'prom-client';
import { CsdpIngestBatch } from '../../../../entities/csdp/csdp-ingest-batch.entity';
import { CsdpIngestRow } from '../../../../entities/csdp/csdp-ingest-row.entity';
import { CsdpCdrRefill } from '../../../../entities/csdp/csdp-cdr-refill.entity';
import { CsdpCdrSdp } from '../../../../entities/csdp/csdp-cdr-sdp.entity';
import { CsdpLoan } from '../../../../entities/csdp/csdp-loan.entity';
import { CsdpRecovery } from '../../../../entities/csdp/csdp-recovery.entity';
import { CsdpSubscriber } from '../../../../entities/csdp/csdp-subscriber.entity';
import { CsdpSubscriberDiscrepancyLog } from '../../../../entities/csdp/csdp-subscriber-discrepancy-log.entity';
import { parseRefill, RefillRow, RefillRowError } from '../parsers/refill.parser';
import { parseSdp, SdpRow, SdpRowError } from '../parsers/sdp.parser';
import { parseVendor, VendorRow, VendorRowError } from '../parsers/vendor.parser';
import {
  parseActivation,
  ActivationRow,
  ActivationRowError,
} from '../parsers/activation.parser';
import { CSDP_METRICS } from '../../csdp-core/metrics/csdp-metrics.module';

export interface IngestJobPayload {
  batch_id: string;
  source: string;
  file_date: string;
  storage_uri: string;
}

const BATCH_SIZE = 1000;

@Processor('csdp-ingest', { concurrency: 1 })
export class IngestProcessor extends WorkerHost {
  private readonly logger = new Logger(IngestProcessor.name);

  constructor(
    @InjectRepository(CsdpIngestBatch, 'csdpBatch')
    private readonly batchRepo: Repository<CsdpIngestBatch>,
    @InjectRepository(CsdpIngestRow, 'csdpBatch')
    private readonly rowRepo: Repository<CsdpIngestRow>,
    @InjectRepository(CsdpCdrRefill, 'csdpBatch')
    private readonly refillRepo: Repository<CsdpCdrRefill>,
    @InjectRepository(CsdpCdrSdp, 'csdpBatch')
    private readonly sdpRepo: Repository<CsdpCdrSdp>,
    @InjectRepository(CsdpLoan, 'csdpBatch')
    private readonly loanRepo: Repository<CsdpLoan>,
    @InjectRepository(CsdpRecovery, 'csdpBatch')
    private readonly recoveryRepo: Repository<CsdpRecovery>,
    @InjectDataSource('csdpBatch')
    private readonly dataSource: DataSource,
    @InjectQueue('csdp-eligibility-linking')
    private readonly linkingQueue: Queue,
    @InjectMetric(CSDP_METRICS.ingestRowsTotal)
    private readonly ingestCounter: Counter,
  ) {
    super();
  }

  async process(job: Job<IngestJobPayload>): Promise<void> {
    const { batch_id, source, file_date, storage_uri } = job.data;

    // Strip file:// prefix
    const filePath = storage_uri.replace(/^file:\/\//, '');

    this.logger.log(`Processing job ${job.name} for batch ${batch_id}`);

    // Mark batch as PARSING
    await this.batchRepo.update({ id: batch_id }, { status: 'PARSING' });

    try {
      switch (job.name) {
        case 'parse-refill':
          await this.processRefill(batch_id, source, file_date, filePath);
          break;
        case 'parse-sdp':
          await this.processSdp(batch_id, source, file_date, filePath);
          break;
        case 'parse-vendor':
          await this.processVendor(batch_id, source, file_date, filePath);
          break;
        case 'parse-activation':
          await this.processActivation(batch_id, source, file_date, filePath);
          break;
        default:
          this.logger.warn(`Unknown job name: ${job.name}, skipping`);
          await this.batchRepo.update(
            { id: batch_id },
            { status: 'FAILED', errorMessage: `Unknown job name: ${job.name}` },
          );
          return;
      }

      // Enqueue eligibility linking sweep
      await this.linkingQueue.add(
        'sweep',
        {},
        {
          jobId: `linking-after-batch-${batch_id}`,
          removeOnComplete: false,
          removeOnFail: false,
        },
      );
    } catch (err: any) {
      this.logger.error(`Batch ${batch_id} failed: ${err.message}`, err.stack);
      await this.batchRepo.update(
        { id: batch_id },
        { status: 'FAILED', errorMessage: err.message ?? String(err) },
      );
      throw err; // Let BullMQ handle retries
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error): void {
    const batchId = job?.data?.batch_id;
    this.logger.error(`Job ${job.id} (batch=${batchId}) permanently failed: ${err.message}`);
    if (batchId) {
      this.batchRepo
        .update({ id: batchId }, { status: 'FAILED', errorMessage: err.message })
        .catch((e) => this.logger.error(`Could not update batch status: ${e.message}`));
    }
  }

  // ---------------------------------------------------------------------------
  // Refill
  // ---------------------------------------------------------------------------

  private async processRefill(
    batchId: string,
    source: string,
    fileDate: string,
    filePath: string,
  ): Promise<void> {
    let rowsTotal = 0;
    let rowsOk = 0;
    let rowsRejected = 0;

    const ingestRowBuffer: Partial<CsdpIngestRow>[] = [];
    const refillBuffer: Partial<CsdpCdrRefill>[] = [];

    const flush = async () => {
      if (refillBuffer.length > 0) {
        await this.dataSource
          .createQueryBuilder()
          .insert()
          .into(CsdpCdrRefill)
          .values(refillBuffer as any)
          .orIgnore()
          .execute();
        refillBuffer.length = 0;
      }
      if (ingestRowBuffer.length > 0) {
        await this.dataSource
          .createQueryBuilder()
          .insert()
          .into(CsdpIngestRow)
          .values(ingestRowBuffer as any)
          .orIgnore()
          .execute();
        ingestRowBuffer.length = 0;
      }
    };

    for await (const row of parseRefill(filePath)) {
      rowsTotal++;

      if ('error' in row) {
        const errRow = row as RefillRowError;
        rowsRejected++;
        this.ingestCounter.inc({ source, status: 'REJECTED' });

        ingestRowBuffer.push({
          batchId,
          source,
          fileDate,
          externalId: `error-line-${errRow.line_no}`,
          lineNo: errRow.line_no,
          rawLine: errRow.raw,
          parsed: null,
          status: 'REJECTED',
          errorReason: errRow.error.substring(0, 255),
        });
      } else {
        const okRow = row as RefillRow;
        rowsOk++;
        this.ingestCounter.inc({ source, status: 'OK' });

        ingestRowBuffer.push({
          batchId,
          source,
          fileDate,
          externalId: okRow.external_id,
          lineNo: okRow.line_no,
          rawLine: JSON.stringify(okRow.raw),
          parsed: {
            msisdn: okRow.msisdn,
            event_at: okRow.event_at.toISOString(),
            amount_naira: okRow.amount_naira,
          },
          status: 'OK',
          errorReason: null,
        });

        refillBuffer.push({
          batchId,
          msisdn: okRow.msisdn,
          eventAt: okRow.event_at,
          amountNaira: okRow.amount_naira,
          serviceClass: okRow.service_class,
          raw: okRow.raw,
        });
      }

      if (ingestRowBuffer.length >= BATCH_SIZE) {
        await flush();
      }
    }

    await flush();

    await this.batchRepo.update(
      { id: batchId },
      { status: 'PARSED', rowsTotal, rowsOk, rowsRejected, parsedAt: new Date() },
    );

    this.logger.log(
      `Batch ${batchId} parsed: total=${rowsTotal} ok=${rowsOk} rejected=${rowsRejected}`,
    );
  }

  // ---------------------------------------------------------------------------
  // SDP
  // ---------------------------------------------------------------------------

  private async processSdp(
    batchId: string,
    source: string,
    fileDate: string,
    filePath: string,
  ): Promise<void> {
    let rowsTotal = 0;
    let rowsOk = 0;
    let rowsRejected = 0;

    const ingestRowBuffer: Partial<CsdpIngestRow>[] = [];
    const sdpBuffer: Partial<CsdpCdrSdp>[] = [];

    const flush = async () => {
      if (sdpBuffer.length > 0) {
        await this.dataSource
          .createQueryBuilder()
          .insert()
          .into(CsdpCdrSdp)
          .values(sdpBuffer as any)
          .orIgnore()
          .execute();
        sdpBuffer.length = 0;
      }
      if (ingestRowBuffer.length > 0) {
        await this.dataSource
          .createQueryBuilder()
          .insert()
          .into(CsdpIngestRow)
          .values(ingestRowBuffer as any)
          .orIgnore()
          .execute();
        ingestRowBuffer.length = 0;
      }
    };

    for await (const row of parseSdp(filePath)) {
      rowsTotal++;

      if ('error' in row) {
        const errRow = row as SdpRowError;
        rowsRejected++;
        this.ingestCounter.inc({ source, status: 'REJECTED' });

        ingestRowBuffer.push({
          batchId,
          source,
          fileDate,
          externalId: `error-line-${errRow.line_no}`,
          lineNo: errRow.line_no,
          rawLine: errRow.raw,
          parsed: null,
          status: 'REJECTED',
          errorReason: errRow.error.substring(0, 255),
        });
      } else {
        const okRow = row as SdpRow;
        rowsOk++;
        this.ingestCounter.inc({ source, status: 'OK' });

        ingestRowBuffer.push({
          batchId,
          source,
          fileDate,
          externalId: okRow.external_id,
          lineNo: okRow.line_no,
          rawLine: JSON.stringify(okRow.raw),
          parsed: {
            msisdn: okRow.msisdn,
            event_at: okRow.event_at.toISOString(),
            amount_naira: okRow.amount_naira,
          },
          status: 'OK',
          errorReason: null,
        });

        sdpBuffer.push({
          batchId,
          msisdn: okRow.msisdn,
          eventAt: okRow.event_at,
          amountNaira: okRow.amount_naira,
          raw: okRow.raw,
        });
      }

      if (ingestRowBuffer.length >= BATCH_SIZE) {
        await flush();
      }
    }

    await flush();

    await this.batchRepo.update(
      { id: batchId },
      { status: 'PARSED', rowsTotal, rowsOk, rowsRejected, parsedAt: new Date() },
    );

    this.logger.log(
      `Batch ${batchId} parsed: total=${rowsTotal} ok=${rowsOk} rejected=${rowsRejected}`,
    );
  }

  // ---------------------------------------------------------------------------
  // Vendor
  // ---------------------------------------------------------------------------

  private async processVendor(
    batchId: string,
    source: string,
    fileDate: string,
    filePath: string,
  ): Promise<void> {
    let rowsTotal = 0;
    let rowsOk = 0;
    let rowsRejected = 0;

    const ingestRowBuffer: Partial<CsdpIngestRow>[] = [];
    const loanBuffer: Partial<CsdpLoan>[] = [];
    const recoveryBuffer: Partial<CsdpRecovery>[] = [];

    const flush = async () => {
      if (loanBuffer.length > 0) {
        await this.dataSource
          .createQueryBuilder()
          .insert()
          .into(CsdpLoan)
          .values(loanBuffer as any)
          .orIgnore()
          .execute();
        loanBuffer.length = 0;
      }
      if (recoveryBuffer.length > 0) {
        await this.dataSource
          .createQueryBuilder()
          .insert()
          .into(CsdpRecovery)
          .values(recoveryBuffer as any)
          .orIgnore()
          .execute();
        recoveryBuffer.length = 0;
      }
      if (ingestRowBuffer.length > 0) {
        await this.dataSource
          .createQueryBuilder()
          .insert()
          .into(CsdpIngestRow)
          .values(ingestRowBuffer as any)
          .orIgnore()
          .execute();
        ingestRowBuffer.length = 0;
      }
    };

    for await (const row of parseVendor(filePath)) {
      rowsTotal++;

      if ('error' in row) {
        const errRow = row as VendorRowError;
        rowsRejected++;
        this.ingestCounter.inc({ source, status: 'REJECTED' });

        ingestRowBuffer.push({
          batchId,
          source,
          fileDate,
          externalId: `error-line-${errRow.line_no}`,
          lineNo: errRow.line_no,
          rawLine: errRow.raw,
          parsed: null,
          status: 'REJECTED',
          errorReason: errRow.error.substring(0, 255),
        });
      } else {
        const okRow = row as VendorRow;
        rowsOk++;
        this.ingestCounter.inc({ source, status: 'OK' });

        ingestRowBuffer.push({
          batchId,
          source,
          fileDate,
          externalId: okRow.external_id,
          lineNo: okRow.line_no,
          rawLine: JSON.stringify(okRow.payload),
          parsed: okRow.payload,
          status: 'OK',
          errorReason: null,
        });

        if (okRow.kind === 'loan') {
          loanBuffer.push(this.mapVendorLoan(okRow.payload, source));
        } else {
          recoveryBuffer.push(this.mapVendorRecovery(okRow.payload));
        }
      }

      if (ingestRowBuffer.length >= BATCH_SIZE) {
        await flush();
      }
    }

    await flush();

    await this.batchRepo.update(
      { id: batchId },
      { status: 'PARSED', rowsTotal, rowsOk, rowsRejected, parsedAt: new Date() },
    );

    this.logger.log(
      `Batch ${batchId} (vendor) parsed: total=${rowsTotal} ok=${rowsOk} rejected=${rowsRejected}`,
    );
  }

  // ---------------------------------------------------------------------------
  // Activation
  // ---------------------------------------------------------------------------

  private async processActivation(
    batchId: string,
    source: string,
    fileDate: string,
    filePath: string,
  ): Promise<void> {
    let rowsTotal = 0;
    let rowsOk = 0;
    let rowsRejected = 0;

    const ingestRowBuffer: Partial<CsdpIngestRow>[] = [];
    const parsedBuffer: ActivationRow[] = [];

    const flushIngestRows = async () => {
      if (ingestRowBuffer.length > 0) {
        await this.dataSource
          .createQueryBuilder()
          .insert()
          .into(CsdpIngestRow)
          .values(ingestRowBuffer as any)
          .orIgnore()
          .execute();
        ingestRowBuffer.length = 0;
      }
    };

    const flushActivation = async () => {
      if (parsedBuffer.length === 0) return;

      const msisdns = parsedBuffer.map((r) => r.msisdn);
      const existing = await this.dataSource
        .getRepository(CsdpSubscriber)
        .createQueryBuilder('s')
        .select(['s.msisdn', 's.activatedAt', 's.serviceClassId'])
        .where('s.msisdn IN (:...msisdns)', { msisdns })
        .getMany();

      const existingByMsisdn = new Map(existing.map((s) => [s.msisdn, s]));

      const upserts: Partial<CsdpSubscriber>[] = [];
      const discrepancies: Partial<CsdpSubscriberDiscrepancyLog>[] = [];

      for (const row of parsedBuffer) {
        const current = existingByMsisdn.get(row.msisdn);

        if (!current) {
          upserts.push({
            msisdn: row.msisdn,
            activatedAt: row.activated_at,
            serviceClassId: row.service_class_id,
          });
          continue;
        }

        // activated_at conflict?
        if (current.activatedAt && current.activatedAt !== row.activated_at) {
          discrepancies.push({
            msisdn: row.msisdn,
            field: 'activated_at',
            existingValue: String(current.activatedAt),
            incomingValue: row.activated_at,
            batchId,
            rowLineNo: row.line_no,
          });
        }

        // service_class_id conflict?
        if (
          current.serviceClassId != null &&
          row.service_class_id != null &&
          current.serviceClassId !== row.service_class_id
        ) {
          discrepancies.push({
            msisdn: row.msisdn,
            field: 'service_class_id',
            existingValue: String(current.serviceClassId),
            incomingValue: String(row.service_class_id),
            batchId,
            rowLineNo: row.line_no,
          });
        }

        // Fill nulls only — never overwrite existing trusted values.
        const needsUpdate =
          current.activatedAt == null || current.serviceClassId == null;
        if (needsUpdate) {
          upserts.push({
            msisdn: row.msisdn,
            activatedAt: current.activatedAt ?? row.activated_at,
            serviceClassId: current.serviceClassId ?? row.service_class_id,
          });
        }
      }

      if (upserts.length > 0) {
        await this.dataSource
          .createQueryBuilder()
          .insert()
          .into(CsdpSubscriber)
          .values(upserts as any)
          .orUpdate(['activated_at', 'service_class_id'], ['msisdn'])
          .execute();
      }

      if (discrepancies.length > 0) {
        await this.dataSource
          .createQueryBuilder()
          .insert()
          .into(CsdpSubscriberDiscrepancyLog)
          .values(discrepancies as any)
          .execute();
      }

      parsedBuffer.length = 0;
    };

    for await (const row of parseActivation(filePath)) {
      rowsTotal++;

      if ('error' in row) {
        const errRow = row as ActivationRowError;
        rowsRejected++;
        this.ingestCounter.inc({ source, status: 'REJECTED' });

        ingestRowBuffer.push({
          batchId,
          source,
          fileDate,
          externalId: `error-line-${errRow.line_no}`,
          lineNo: errRow.line_no,
          rawLine: errRow.raw,
          parsed: null,
          status: 'REJECTED',
          errorReason: errRow.error.substring(0, 255),
        });
      } else {
        const okRow = row as ActivationRow;
        rowsOk++;
        this.ingestCounter.inc({ source, status: 'OK' });

        ingestRowBuffer.push({
          batchId,
          source,
          fileDate,
          externalId: okRow.external_id,
          lineNo: okRow.line_no,
          rawLine: JSON.stringify(okRow.raw),
          parsed: {
            msisdn: okRow.msisdn,
            activated_at: okRow.activated_at,
            service_class_id: okRow.service_class_id,
          },
          status: 'OK',
          errorReason: null,
        });

        parsedBuffer.push(okRow);
      }

      if (parsedBuffer.length >= BATCH_SIZE) {
        await flushActivation();
      }
      if (ingestRowBuffer.length >= BATCH_SIZE) {
        await flushIngestRows();
      }
    }

    await flushActivation();
    await flushIngestRows();

    await this.batchRepo.update(
      { id: batchId },
      { status: 'PARSED', rowsTotal, rowsOk, rowsRejected, parsedAt: new Date() },
    );

    this.logger.log(
      `Batch ${batchId} (activation) parsed: total=${rowsTotal} ok=${rowsOk} rejected=${rowsRejected}`,
    );
  }

  // ---------------------------------------------------------------------------
  // Vendor payload mappers
  // ---------------------------------------------------------------------------

  private mapVendorLoan(
    payload: Record<string, string>,
    source: string,
  ): Partial<CsdpLoan> {
    const vendor = source.split(':')[1]?.toUpperCase() ?? 'OTHER';
    return {
      loanId: payload['loan_id'] ?? payload['id'] ?? '',
      msisdn: payload['msisdn'] ?? '',
      vendor,
      loanType: (payload['loan_type'] ?? 'AIRTIME').toUpperCase(),
      principalNaira: payload['principal_naira'] ?? payload['principal'] ?? '0',
      repayableNaira: payload['repayable_naira'] ?? payload['repayable'] ?? '0',
      status: (payload['status'] ?? 'ISSUED').toUpperCase() as CsdpLoan['status'],
      transRef: payload['trans_ref'] ?? null,
      issuedAt: payload['issued_at'] ? new Date(payload['issued_at']) : new Date(),
      recoveredAt: payload['recovered_at'] ? new Date(payload['recovered_at']) : null,
    };
  }

  private mapVendorRecovery(payload: Record<string, string>): Partial<CsdpRecovery> {
    // Vendor file may carry either `amount_naira` or the legacy `amount_kobo`
    // field name; we treat the value as naira (matches production data).
    return {
      recoveryId: payload['recovery_id'] ?? payload['id'] ?? '',
      msisdn: payload['msisdn'] ?? '',
      amountNaira: payload['amount_naira'] ?? payload['amount_kobo'] ?? '0',
      recoveredAt: payload['recovered_at'] ? new Date(payload['recovered_at']) : new Date(),
    };
  }
}
