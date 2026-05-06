import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TeamweeModule } from './teamwee/teamwee.module';
import { CsdpFeatureFlagsModule } from '../csdp-feature-flags/csdp-feature-flags.module';
import { CsdpLinkingModule } from '../csdp-linking/csdp-linking.module';
import { CsdpScoringModule } from '../csdp-scoring/csdp-scoring.module';
import { EligibilitySnapshotService } from './eligibility-snapshot.service';
import { CsdpEligibilityLog } from '../../../entities/csdp/csdp-eligibility-log.entity';
import { EligibilityController } from './eligibility.controller';
import { DecisionRouterService } from './decision-router.service';
import { EligibilityLoggerService } from './eligibility-logger.service';
import { EligibilityLogProcessor } from './processors/eligibility-log.processor';
import { ProfileIdempotencyService } from './profile-idempotency.service';

@Module({
  imports: [
    TeamweeModule,
    CsdpFeatureFlagsModule,
    CsdpLinkingModule,
    CsdpScoringModule,
    BullModule.registerQueue({ name: 'csdp-eligibility-log' }),
    TypeOrmModule.forFeature([CsdpEligibilityLog], 'csdpBatch'),
  ],
  controllers: [EligibilityController],
  providers: [
    DecisionRouterService,
    EligibilityLoggerService,
    EligibilityLogProcessor,
    ProfileIdempotencyService,
    EligibilitySnapshotService,
  ],
  exports: [DecisionRouterService, EligibilitySnapshotService],
})
export class CsdpEligibilityModule {}
