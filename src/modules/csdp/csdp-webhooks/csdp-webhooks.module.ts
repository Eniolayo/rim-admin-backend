import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { CsdpLoan } from '../../../entities/csdp/csdp-loan.entity';
import { CsdpRecovery } from '../../../entities/csdp/csdp-recovery.entity';
import { CsdpRecoveryLoanItem } from '../../../entities/csdp/csdp-recovery-loan-item.entity';
import { CsdpWebhookInboundLog } from '../../../entities/csdp/csdp-webhook-inbound-log.entity';
import { CsdpSubscriber } from '../../../entities/csdp/csdp-subscriber.entity';
import { CsdpWebhookInboundLogModule } from '../csdp-core/webhook-inbound-log/csdp-webhook-inbound-log.module';
import { CsdpSubscribersModule } from '../csdp-subscribers/csdp-subscribers.module';
import { CsdpLinkingModule } from '../csdp-linking/csdp-linking.module';
import { WebhooksController } from './webhooks.controller';
import { AirtelWebhookController } from './airtel-webhook.controller';
import { AirtelWebhookMapper } from './airtel-webhook.mapper';
import { AirtelApiKeyGuard } from './airtel-api-key.guard';
import { IdempotencyGuard } from './idempotency.guard';
import { LoanProcessor } from './processors/loan.processor';
import { RecoveryProcessor } from './processors/recovery.processor';

@Module({
  imports: [
    TypeOrmModule.forFeature(
      [CsdpLoan, CsdpRecovery, CsdpRecoveryLoanItem, CsdpWebhookInboundLog, CsdpSubscriber],
      'csdpHot',
    ),
    TypeOrmModule.forFeature(
      [CsdpLoan, CsdpRecovery, CsdpRecoveryLoanItem, CsdpSubscriber],
      'csdpBatch',
    ),
    BullModule.registerQueue(
      { name: 'csdp-loan-notifications' },
      { name: 'csdp-recovery-notifications' },
    ),
    CsdpWebhookInboundLogModule,
    CsdpSubscribersModule,
    CsdpLinkingModule,
  ],
  controllers: [WebhooksController, AirtelWebhookController],
  providers: [
    IdempotencyGuard,
    AirtelApiKeyGuard,
    AirtelWebhookMapper,
    LoanProcessor,
    RecoveryProcessor,
  ],
})
export class CsdpWebhooksModule {}
