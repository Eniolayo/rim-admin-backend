import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

export interface DisburseLoanData {
  loanId: string; // Database UUID (id field)
  userId: string;
}

@Injectable()
export class LoanDisburseQueueService {
  private readonly logger = new Logger(LoanDisburseQueueService.name);

  constructor(
    @InjectQueue('loan-disbursement')
    private readonly loanDisburseQueue: Queue,
  ) {}

  /**
   * Enqueue a loan disbursement job (non-blocking, fire-and-forget)
   */
  async enqueue(data: DisburseLoanData): Promise<void> {
    try {
      await this.loanDisburseQueue.add('disburse-loan', data, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: {
          count: 10, // Keep only last 10 completed jobs for debugging
        },
        removeOnFail: {
          age: 86400, // Keep failed jobs for 24 hours for troubleshooting
        },
      });
    } catch (error) {
      // Don't break request flow if queue fails
      this.logger.error(
        `Failed to enqueue loan disbursement: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}

