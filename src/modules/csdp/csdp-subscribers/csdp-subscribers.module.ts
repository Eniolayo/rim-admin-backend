import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CsdpSubscriber } from '../../../entities/csdp/csdp-subscriber.entity';
import { CsdpEligibilityLog } from '../../../entities/csdp/csdp-eligibility-log.entity';
import { CsdpLoan } from '../../../entities/csdp/csdp-loan.entity';
import { CsdpRecovery } from '../../../entities/csdp/csdp-recovery.entity';
import { CsdpSubscribersController } from './csdp-subscribers.controller';
import { SubscriberBalanceService } from './subscriber-balance.service';
import { CsdpSubscribersService } from './csdp-subscribers.service';

@Module({
  imports: [
    TypeOrmModule.forFeature(
      [CsdpSubscriber, CsdpEligibilityLog, CsdpLoan, CsdpRecovery],
      'csdpHot',
    ),
  ],
  controllers: [CsdpSubscribersController],
  providers: [SubscriberBalanceService, CsdpSubscribersService],
  exports: [SubscriberBalanceService, CsdpSubscribersService],
})
export class CsdpSubscribersModule {}
