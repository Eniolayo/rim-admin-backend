import { Logger } from '@nestjs/common';
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { ExposurePublisherService } from './exposure-publisher.service';

export const EXPOSURE_JOB_PUBLISH = 'publish';

@Processor('csdp-exposure', { concurrency: 1 })
export class ExposurePublisherProcessor extends WorkerHost {
  private readonly logger = new Logger(ExposurePublisherProcessor.name);

  constructor(private readonly publisher: ExposurePublisherService) {
    super();
  }

  async process(job: Job): Promise<{ pct: number } | null> {
    if (job.name !== EXPOSURE_JOB_PUBLISH) {
      this.logger.warn(`Unknown job name: ${job.name}, skipping`);
      return null;
    }
    const pct = await this.publisher.publishOnce();
    return { pct };
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error): void {
    this.logger.error(
      `Exposure publish job ${job.id} failed: ${error.message}`,
      error.stack,
    );
  }
}
