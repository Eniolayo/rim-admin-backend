import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CsdpWebhookInboundLog } from '../../../../entities/csdp/csdp-webhook-inbound-log.entity';
import { InboundLogService } from './inbound-log.service';

@Module({
  imports: [TypeOrmModule.forFeature([CsdpWebhookInboundLog], 'csdpHot')],
  providers: [InboundLogService],
  exports: [InboundLogService],
})
export class CsdpWebhookInboundLogModule {}
