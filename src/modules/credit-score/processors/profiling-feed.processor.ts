import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from 'nestjs-pino';
import { CreditScoreService } from '../services/credit-score.service';
import { CreditFeedFetcherService } from '../services/credit-feed-fetcher.service';
import { CreditFeedParserService } from '../services/credit-feed-parser.service';
import { CreditFeedBulkUpdateService } from '../services/credit-feed-bulk-update.service';

interface FeedProcessingJob {
  timestamp: string;
  manual?: boolean;
}

/**
 * Processor for handling Airtel profiling feed jobs.
 */
@Processor('profiling-feed', { concurrency: 1 })
export class ProfilingFeedProcessor extends WorkerHost {
  constructor(
    private readonly creditScoreService: CreditScoreService,
    private readonly feedFetcher: CreditFeedFetcherService,
    private readonly feedParser: CreditFeedParserService,
    private readonly bulkUpdateService: CreditFeedBulkUpdateService,
    private readonly logger: Logger,
  ) {
    super();
  }

  async process(job: Job<FeedProcessingJob, any, string>): Promise<any> {
    this.logger.log(
      { jobId: job.id, jobName: job.name },
      'Processing profiling feed job...',
    );

    if (job.name === 'process-feed') {
      return this.handleFeedIngestion(job);
    }

    return null;
  }

  /**
   * Logic to fetch, parse, and process the profiling feed.
   */
  private async handleFeedIngestion(
    job: Job<FeedProcessingJob>,
  ): Promise<{ processed: number; errors: number; filesProcessed: number }> {
    const startTime = Date.now();
    let totalProcessed = 0;
    let totalErrors = 0;
    let filesProcessed = 0;

    try {
      this.logger.log('Fetching credit feed files...');

      // 1. Fetch files from configured source
      const files = await this.feedFetcher.fetchFiles();

      if (files.length === 0) {
        this.logger.log('No credit feed files found to process');
        return { processed: 0, errors: 0, filesProcessed: 0 };
      }

      this.logger.log(
        { fileCount: files.length },
        'Found credit feed files to process',
      );

      // 2. Process each file
      for (const file of files) {
        try {
          this.logger.log(
            { fileName: file.fileName, fileType: file.fileType },
            'Processing credit feed file',
          );

          // Update job progress
          await job.updateProgress({
            currentFile: file.fileName,
            filesProcessed,
            totalFiles: files.length,
          });

          // Download file if needed (for S3/FTP)
          const filePath =
            file.filePath || (await this.feedFetcher.downloadFile(file));

          // 3. Parse file
          const records = await this.feedParser.parseFile(
            filePath,
            file.fileType,
          );

          if (records.length === 0) {
            this.logger.warn(
              { fileName: file.fileName },
              'No records found in file',
            );
            continue;
          }

          this.logger.log(
            { fileName: file.fileName, recordCount: records.length },
            'File parsed successfully',
          );

          // 4. Bulk update credit scores
          const result = await this.bulkUpdateService.bulkUpdateCreditScores(
            records,
          );

          totalProcessed += result.processed;
          totalErrors += result.errors;

          this.logger.log(
            {
              fileName: file.fileName,
              processed: result.processed,
              errors: result.errors,
            },
            'File processing completed',
          );

          // 5. Archive processed file
          await this.feedFetcher.archiveFile(file);

          filesProcessed++;

          // Update job progress
          await job.updateProgress({
            currentFile: null,
            filesProcessed,
            totalFiles: files.length,
            totalProcessed,
            totalErrors,
          });
        } catch (fileError) {
          totalErrors++;
          this.logger.error(
            {
              fileName: file.fileName,
              error:
                fileError instanceof Error
                  ? fileError.message
                  : String(fileError),
            },
            'Error processing file',
          );
        }
      }

      const duration = Date.now() - startTime;

      this.logger.log(
        {
          processed: totalProcessed,
          errors: totalErrors,
          filesProcessed,
          duration,
        },
        'Credit feed processing completed',
      );

      return {
        processed: totalProcessed,
        errors: totalErrors,
        filesProcessed,
      };
    } catch (error) {
      this.logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          jobId: job.id,
        },
        'Critical error during credit feed ingestion',
      );
      throw error;
    }
  }
}
