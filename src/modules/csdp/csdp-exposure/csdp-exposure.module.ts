import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { CsdpLinkingModule } from '../csdp-linking/csdp-linking.module';
import { SystemConfigModule } from '../../system-config/system-config.module';
import { ExposurePublisherService } from './exposure-publisher.service';
import { ExposurePublisherProcessor } from './exposure-publisher.processor';
import { ExposurePublisherScheduler } from './exposure-publisher.scheduler';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'csdp-exposure' }),
    CsdpLinkingModule,
    SystemConfigModule,
  ],
  providers: [
    ExposurePublisherService,
    ExposurePublisherProcessor,
    ExposurePublisherScheduler,
  ],
})
export class CsdpExposureModule {}
