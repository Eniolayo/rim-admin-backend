import { Module } from '@nestjs/common';
import { CsdpLinkingModule } from '../csdp-linking/csdp-linking.module';
import { SystemConfigModule } from '../../system-config/system-config.module';
import { CsdpScoringService } from './csdp-scoring.service';
import { CsdpScoringConfigLoader } from './csdp-scoring-config.loader';

@Module({
  imports: [CsdpLinkingModule, SystemConfigModule],
  providers: [CsdpScoringService, CsdpScoringConfigLoader],
  exports: [CsdpScoringService, CsdpScoringConfigLoader],
})
export class CsdpScoringModule {}
