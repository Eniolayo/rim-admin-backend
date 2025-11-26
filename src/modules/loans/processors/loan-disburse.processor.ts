import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { LoansService } from '../services/loans.service';
import { DisburseLoanData } from '../services/loan-disburse-queue.service';
import { AdminUser } from '../../../entities/admin-user.entity';
import { LoanRepository } from '../repositories/loan.repository';
import { LoanStatus } from '../../../entities/loan.entity';

@Processor('loan-disbursement', {
  concurrency: 3, // Process up to 3 disbursements in parallel
})
export class LoanDisburseProcessor extends WorkerHost {
  private readonly logger = new Logger(LoanDisburseProcessor.name);

  constructor(
    private readonly loansService: LoansService,
    private readonly loanRepository: LoanRepository,
  ) {
    super();
  }

  async process(job: Job<DisburseLoanData>): Promise<void> {
    const { data } = job;
    const { loanId, userId } = data; // loanId is actually the database UUID (id field)

    this.logger.log(
      { loanId, userId, jobId: job.id },
      'Processing loan disbursement job',
    );

    try {
      // Check loan status before processing to provide better logging
      const loan = await this.loanRepository.findById(loanId);
      const wasAlreadyDisbursed = loan?.status === LoanStatus.DISBURSED;

      // Create a minimal AdminUser object for the disburse method
      // The method doesn't actually use it (it's prefixed with _)
      // Using Partial to satisfy type requirements
      const systemAdmin = {
        id: 'system',
        email: 'system@rim.ng',
        username: 'system',
      } as Partial<AdminUser> as AdminUser;

      // loanId contains the database UUID, which disburse() can use directly
      // disburse() will handle already-disbursed loans gracefully (idempotent)
      const result = await this.loansService.disburse(loanId, systemAdmin);

      if (wasAlreadyDisbursed) {
        this.logger.log(
          { loanId, userId, jobId: job.id, loanBusinessId: result.loanId },
          'Loan was already disbursed, operation completed successfully',
        );
      } else {
        this.logger.log(
          { loanId, userId, jobId: job.id, loanBusinessId: result.loanId },
          'Loan disbursement completed successfully',
        );
      }
    } catch (error) {
      this.logger.error(
        {
          loanId,
          userId,
          jobId: job.id,
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to disburse loan',
      );
      // Re-throw to trigger BullMQ retry
      throw error;
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.debug(`Loan disbursement job ${job.id} completed`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(
      `Loan disbursement job ${job.id} failed: ${error.message}`,
      error.stack,
    );
  }
}

