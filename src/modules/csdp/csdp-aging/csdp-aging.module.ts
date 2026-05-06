import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AgingProcessor } from './aging.processor';
import { AgingScheduler } from './aging.scheduler';

@Module({
  imports: [BullModule.registerQueue({ name: 'csdp-aging' })],
  providers: [AgingProcessor, AgingScheduler],
})
export class CsdpAgingModule {}
