import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { CsdpEligibilityLog } from '../../../entities/csdp/csdp-eligibility-log.entity';
import { CsdpIngestBatch } from '../../../entities/csdp/csdp-ingest-batch.entity';
import { CsdpLoan } from '../../../entities/csdp/csdp-loan.entity';
import { CsdpRecovery } from '../../../entities/csdp/csdp-recovery.entity';
import { CsdpSubscriber } from '../../../entities/csdp/csdp-subscriber.entity';
import { CsdpSubscribersModule } from '../csdp-subscribers/csdp-subscribers.module';
import { CsdpFeatureFlagsModule } from '../csdp-feature-flags/csdp-feature-flags.module';
import { CsdpDashboardController } from './phase1.controller';
import { Phase1DashboardService } from './phase1.service';
import { CsdpDashboardGateway } from './phase1.gateway';
import { AuthModule } from '../../auth/auth.module';
import { WsJwtGuard } from '../../auth/guards/ws-jwt.guard';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: 'csdp-eligibility-log' },
      { name: 'csdp-loan-notifications' },
      { name: 'csdp-recovery-notifications' },
      { name: 'csdp-eligibility-linking' },
      { name: 'csdp-ingest' },
    ),
    TypeOrmModule.forFeature(
      [
        CsdpEligibilityLog,
        CsdpIngestBatch,
        CsdpLoan,
        CsdpRecovery,
        CsdpSubscriber,
      ],
      'csdpHot',
    ),
    CsdpSubscribersModule,
    CsdpFeatureFlagsModule,
    AuthModule,
  ],
  controllers: [CsdpDashboardController],
  providers: [Phase1DashboardService, CsdpDashboardGateway, WsJwtGuard],
})
export class CsdpDashboardModule {}
