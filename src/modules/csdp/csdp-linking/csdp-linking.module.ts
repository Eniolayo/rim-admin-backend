import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CsdpEligibilityLog } from '../../../entities/csdp/csdp-eligibility-log.entity';
import { CsdpEligibilityOutcome } from '../../../entities/csdp/csdp-eligibility-outcome.entity';
import { CsdpLoan } from '../../../entities/csdp/csdp-loan.entity';
import { CsdpRecovery } from '../../../entities/csdp/csdp-recovery.entity';
import { EligibilityLinkingProcessor } from './processors/eligibility-linking.processor';
import { EligibilityLinkingScheduler } from './eligibility-linking.scheduler';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'csdp-eligibility-linking' }),
    TypeOrmModule.forFeature(
      [CsdpEligibilityLog, CsdpEligibilityOutcome, CsdpLoan, CsdpRecovery],
      'csdpBatch',
    ),
  ],
  providers: [EligibilityLinkingProcessor, EligibilityLinkingScheduler],
})
export class CsdpLinkingModule {}
