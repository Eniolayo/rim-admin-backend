import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter } from 'prom-client';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../auth/decorators/public.decorator';
import { CsdpApiKeyGuard } from '../../auth/guards/csdp-api-key.guard';
import { CsdpScopes } from '../../auth/decorators/csdp-scopes.decorator';
import { InboundLogService } from '../csdp-core/webhook-inbound-log/inbound-log.service';
import { CSDP_METRICS } from '../csdp-core/metrics/csdp-metrics.module';
import { IdempotencyGuard } from './idempotency.guard';
import { WebhookKind } from './webhook-kind.decorator';
import { LoanWebhookDto } from './dto/loan-webhook.dto';
import { RecoveryWebhookDto } from './dto/recovery-webhook.dto';

@Controller('csdp/webhooks')
@Public()
@UseGuards(CsdpApiKeyGuard, IdempotencyGuard)
export class WebhooksController {
  constructor(
    private readonly inboundLog: InboundLogService,
    @InjectQueue('csdp-loan-notifications') private readonly loanQueue: Queue,
    @InjectQueue('csdp-recovery-notifications')
    private readonly recoveryQueue: Queue,
    @InjectMetric(CSDP_METRICS.webhookInboundTotal)
    private readonly counter: Counter,
  ) {}

  @Post('loan')
  @HttpCode(202)
  @CsdpScopes('csdp:webhook')
  @WebhookKind('loan')
  @Throttle({ default: { limit: 200, ttl: 60_000 } })
  async loan(@Body() dto: LoanWebhookDto, @Req() req: any) {
    if (req.duplicateOf) {
      this.counter.inc({ kind: 'loan', result: 'duplicate' });
      return { duplicate: true, ...req.duplicateOf };
    }
    const inbound = await this.inboundLog.record(
      'loan',
      dto.loan_id,
      dto,
      this.safeHeaders(req),
    );
    await this.loanQueue.add(
      'loan',
      { ...dto, inbound_log_id: inbound.id },
      {
        removeOnComplete: 1000,
        removeOnFail: false,
        attempts: 5,
        backoff: { type: 'exponential', delay: 2000 },
      },
    );
    this.counter.inc({ kind: 'loan', result: 'accepted' });
    return { accepted: true };
  }

  @Post('recovery')
  @HttpCode(202)
  @CsdpScopes('csdp:webhook')
  @WebhookKind('recovery')
  @Throttle({ default: { limit: 200, ttl: 60_000 } })
  async recovery(@Body() dto: RecoveryWebhookDto, @Req() req: any) {
    if (req.duplicateOf) {
      this.counter.inc({ kind: 'recovery', result: 'duplicate' });
      return { duplicate: true, ...req.duplicateOf };
    }
    const inbound = await this.inboundLog.record(
      'recovery',
      dto.recovery_id,
      dto,
      this.safeHeaders(req),
    );
    await this.recoveryQueue.add(
      'recovery',
      { ...dto, inbound_log_id: inbound.id },
      {
        removeOnComplete: 1000,
        removeOnFail: false,
        attempts: 5,
        backoff: { type: 'exponential', delay: 2000 },
      },
    );
    this.counter.inc({ kind: 'recovery', result: 'accepted' });
    return { accepted: true };
  }

  private safeHeaders(req: any): Record<string, any> {
    const safe = { ...req.headers };
    delete safe['x-csdp-api-key'];
    delete safe['authorization'];
    return safe;
  }
}
