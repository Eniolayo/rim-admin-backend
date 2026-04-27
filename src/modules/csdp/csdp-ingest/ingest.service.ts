import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { CsdpIngestBatch } from '../../../entities/csdp/csdp-ingest-batch.entity';
import { UploadDto } from './dto/upload.dto';
import { MulterFile } from './multer-file.type';

@Injectable()
export class IngestService {
  private readonly logger = new Logger(IngestService.name);
  private readonly storageDir: string;

  constructor(
    @InjectRepository(CsdpIngestBatch, 'csdpHot')
    private readonly batchRepo: Repository<CsdpIngestBatch>,
    @InjectQueue('csdp-ingest')
    private readonly queue: Queue,
    private readonly config: ConfigService,
  ) {
    this.storageDir =
      config.get<string>('CSDP_INGEST_STORAGE_DIR') ?? '/tmp/csdp-ingest';
  }

  /**
   * Receive an uploaded file, deduplicate by SHA-256, store it, persist a
   * CsdpIngestBatch record, and enqueue a parse job.
   */
  async receive(
    file: MulterFile,
    dto: UploadDto,
  ): Promise<{ batch_id: string; status: string; duplicate: boolean }> {
    // 1. Compute SHA-256 of the uploaded file
    const hash = await this.hashFile(file.path);

    // 2. Validate client-supplied hash if provided
    if (dto.expected_hash && dto.expected_hash !== hash) {
      await fs.promises.unlink(file.path).catch(() => undefined);
      throw new BadRequestException(
        `SHA-256 mismatch: expected ${dto.expected_hash}, got ${hash}`,
      );
    }

    // 3. Check for duplicate
    const existing = await this.batchRepo.findOne({ where: { fileHash: hash } });
    if (existing) {
      await fs.promises.unlink(file.path).catch(() => undefined);
      this.logger.log(`Duplicate batch detected: ${existing.id} (hash=${hash})`);
      return { batch_id: existing.id, status: existing.status, duplicate: true };
    }

    // 4. Move file to permanent storage location
    const destDir = path.join(this.storageDir, dto.source, dto.file_date);
    await fs.promises.mkdir(destDir, { recursive: true });
    const destPath = path.join(destDir, `${hash}.dat`);
    await fs.promises.rename(file.path, destPath);

    const storageUri = `file://${destPath}`;
    const batchId = uuidv4();

    // 5. Insert CsdpIngestBatch
    const batch = this.batchRepo.create({
      id: batchId,
      source: dto.source,
      fileDate: dto.file_date,
      fileHash: hash,
      status: 'RECEIVED',
      storageUri,
      rowsTotal: 0,
      rowsOk: 0,
      rowsRejected: 0,
      errorMessage: null,
      parsedAt: null,
    });
    await this.batchRepo.save(batch);

    // 6. Enqueue parse job
    const jobName = this.resolveJobName(dto.source);
    await this.queue.add(
      jobName,
      { batch_id: batchId, source: dto.source, file_date: dto.file_date, storage_uri: storageUri },
      { attempts: 3, removeOnComplete: false, removeOnFail: false },
    );

    this.logger.log(`Batch ${batchId} received (source=${dto.source}, date=${dto.file_date})`);
    return { batch_id: batchId, status: 'RECEIVED', duplicate: false };
  }

  async listBatches(opts?: {
    source?: string;
    status?: string;
    limit?: number;
  }): Promise<CsdpIngestBatch[]> {
    const qb = this.batchRepo
      .createQueryBuilder('b')
      .orderBy('b.createdAt', 'DESC')
      .take(opts?.limit ?? 50);

    if (opts?.source) {
      qb.andWhere('b.source = :source', { source: opts.source });
    }
    if (opts?.status) {
      qb.andWhere('b.status = :status', { status: opts.status });
    }

    return qb.getMany();
  }

  async getBatch(id: string): Promise<CsdpIngestBatch | null> {
    return this.batchRepo.findOne({ where: { id } });
  }

  /**
   * Re-enqueue a batch for parsing. Refuses if currently PARSING.
   */
  async replay(id: string, actorId: string): Promise<void> {
    const batch = await this.batchRepo.findOne({ where: { id } });
    if (!batch) {
      throw new NotFoundException(`Batch ${id} not found`);
    }
    if (batch.status === 'PARSING') {
      throw new BadRequestException(`Batch ${id} is currently PARSING; wait for it to finish`);
    }

    this.logger.log(`Replay requested for batch ${id} by actor ${actorId}`);

    // Reset status
    batch.status = 'RECEIVED';
    batch.parsedAt = null;
    batch.errorMessage = null;
    batch.rowsTotal = 0;
    batch.rowsOk = 0;
    batch.rowsRejected = 0;
    await this.batchRepo.save(batch);

    const jobName = this.resolveJobName(batch.source);
    await this.queue.add(
      jobName,
      {
        batch_id: id,
        source: batch.source,
        file_date: batch.fileDate,
        storage_uri: batch.storageUri,
      },
      { attempts: 3, removeOnComplete: false, removeOnFail: false },
    );

    this.logger.log(`Batch ${id} re-enqueued as ${jobName}`);
  }

  // ---------------------------------------------------------------------------

  private resolveJobName(source: string): string {
    if (source === 'refill') return 'parse-refill';
    if (source === 'sdp') return 'parse-sdp';
    return 'parse-vendor'; // vendor:avyra | vendor:erl | vendor:fonyou
  }

  private hashFile(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);
      stream.on('data', (chunk) => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }
}
