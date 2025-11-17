import { Injectable } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq'
import { Queue } from 'bullmq'

export interface CreditScoreAwardJob {
  transactionId: string
  loanId: string
  phoneNumber?: string | null
}

@Injectable()
export class CreditScoreQueueService {
  constructor(@InjectQueue('credit-score-award') private readonly queue: Queue) {}

  async enqueueAward(job: CreditScoreAwardJob): Promise<void> {
    await this.queue.add('award', job, {
      attempts: 5,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: { count: 50 },
      removeOnFail: { age: 86400 },
    })
  }
}

