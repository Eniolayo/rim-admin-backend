import { Module } from '@nestjs/common';
import { CsdpRedisModule } from './csdp-core/redis-cache/csdp-redis.module';
import { CsdpMetricsModule } from './csdp-core/metrics/csdp-metrics.module';
import { CsdpFeatureFlagsModule } from './csdp-feature-flags/csdp-feature-flags.module';
import { CsdpSubscribersModule } from './csdp-subscribers/csdp-subscribers.module';
import { CsdpEligibilityModule } from './csdp-eligibility/csdp-eligibility.module';
import { CsdpWebhooksModule } from './csdp-webhooks/csdp-webhooks.module';
import { CsdpLinkingModule } from './csdp-linking/csdp-linking.module';
import { CsdpIngestModule } from './csdp-ingest/csdp-ingest.module';
import { CsdpDashboardModule } from './csdp-dashboard/csdp-dashboard.module';

@Module({
  imports: [
    CsdpRedisModule,
    CsdpMetricsModule,
    CsdpFeatureFlagsModule,
    CsdpSubscribersModule,
    CsdpEligibilityModule,
    CsdpWebhooksModule,
    CsdpLinkingModule,
    CsdpIngestModule,
    CsdpDashboardModule,
  ],
  exports: [
    CsdpRedisModule,
    CsdpMetricsModule,
    CsdpFeatureFlagsModule,
    CsdpSubscribersModule,
    CsdpEligibilityModule,
    CsdpWebhooksModule,
    CsdpLinkingModule,
    CsdpIngestModule,
    CsdpDashboardModule,
  ],
})
export class CsdpModule {}
