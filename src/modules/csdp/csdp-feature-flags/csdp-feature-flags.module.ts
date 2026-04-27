import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { CsdpFeatureFlag } from '../../../entities/csdp/csdp-feature-flag.entity';
import { CsdpFeatureFlagsService } from './csdp-feature-flags.service';
import { CsdpFeatureFlagsController } from './csdp-feature-flags.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([CsdpFeatureFlag], 'csdpHot'),
    BullModule.registerQueue({ name: 'activity-logs' }),
  ],
  controllers: [CsdpFeatureFlagsController],
  providers: [CsdpFeatureFlagsService],
  exports: [CsdpFeatureFlagsService],
})
export class CsdpFeatureFlagsModule {}
