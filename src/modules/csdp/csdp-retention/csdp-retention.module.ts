import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { RetentionProcessor } from './retention.processor';
import { RetentionScheduler } from './retention.scheduler';

@Module({
  imports: [BullModule.registerQueue({ name: 'csdp-retention' })],
  providers: [RetentionProcessor, RetentionScheduler],
})
export class CsdpRetentionModule {}
