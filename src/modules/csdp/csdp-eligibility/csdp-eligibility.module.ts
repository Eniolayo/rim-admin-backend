import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TeamweeModule } from './teamwee/teamwee.module';
import { CsdpFeatureFlagsModule } from '../csdp-feature-flags/csdp-feature-flags.module';
import { CsdpEligibilityLog } from '../../../entities/csdp/csdp-eligibility-log.entity';
import { EligibilityController } from './eligibility.controller';
import { DecisionRouterService } from './decision-router.service';
import { EligibilityLoggerService } from './eligibility-logger.service';
import { EligibilityLogProcessor } from './processors/eligibility-log.processor';

@Module({
  imports: [
    TeamweeModule,
    CsdpFeatureFlagsModule,
    BullModule.registerQueue({ name: 'csdp-eligibility-log' }),
    TypeOrmModule.forFeature([CsdpEligibilityLog], 'csdpBatch'),
  ],
  controllers: [EligibilityController],
  providers: [DecisionRouterService, EligibilityLoggerService, EligibilityLogProcessor],
  exports: [DecisionRouterService],
})
export class CsdpEligibilityModule {}
