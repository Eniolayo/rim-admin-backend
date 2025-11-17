import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq'
import { Job } from 'bullmq'
import { Injectable } from '@nestjs/common'
import { Logger } from 'nestjs-pino'
import { CreditScoreService } from '../services/credit-score.service'
import { CreditScoreAwardJob } from '../services/credit-score-queue.service'

@Processor('credit-score-award', { concurrency: 5 })
@Injectable()
export class CreditScoreAwardProcessor extends WorkerHost {
  constructor(private readonly creditScoreService: CreditScoreService, private readonly logger: Logger) {
    super()
  }

  async process(job: Job<CreditScoreAwardJob>): Promise<void> {
    const { transactionId, loanId, phoneNumber } = job.data
    try {
      this.logger.log({ jobId: job.id, transactionId, loanId, phoneNumber }, 'Processing credit score award job')
      await this.creditScoreService.awardPointsForRepayment(transactionId, loanId, phoneNumber)
      this.logger.log({ jobId: job.id, transactionId, loanId }, 'Credit score award job completed successfully')
    } catch (error) {
      this.logger.error({ jobId: job.id, transactionId, loanId, phoneNumber, error: error instanceof Error ? error.message : String(error), attempts: job.attemptsMade }, 'Credit score award job failed')
      throw error
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job): void {
    this.logger.log({ jobId: job.id, transactionId: job.data.transactionId, loanId: job.data.loanId }, 'Credit score award job completed')
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error): void {
    this.logger.error({ jobId: job.id, transactionId: job.data.transactionId, loanId: job.data.loanId, error: err.message, attempts: job.attemptsMade }, 'Credit score award job failed')
  }
}

