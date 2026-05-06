import {
  Body,
  Controller,
  HttpCode,
  Logger,
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
import { InboundLogService } from '../csdp-core/webhook-inbound-log/inbound-log.service';
import { CSDP_METRICS } from '../csdp-core/metrics/csdp-metrics.module';
import { AirtelApiKeyGuard } from './airtel-api-key.guard';
import { AirtelLoanWebhookDto } from './dto/airtel-loan-webhook.dto';
import { AirtelRecoveryWebhookDto } from './dto/airtel-recovery-webhook.dto';
import { AirtelWebhookMapper } from './airtel-webhook.mapper';

/**
 * Airtel-facing webhook routes per docs/AIRTEL_CSDP_INTEGRATION_API.md
 * §2 (`POST /loan-notification`) and §3 (`POST /recovery-notification`).
 *
 * Both routes:
 * - Require `Authorization: ApiKey {api-key}` (enforced by
 *   `AirtelApiKeyGuard`).
 * - Accept the Airtel wire shape, map it to the internal DTO via
 *   `AirtelWebhookMapper`, and enqueue onto the same Bull queues used
 *   by the existing internal `WebhooksController` so Phase 2
 *   idempotency, live writers, snapshots, and live counters all keep
 *   working unchanged.
 * - Respond with `{ success: true }` on accept and the standard 4XX /
 *   5XX status codes on validation / internal failure.
 *
 * The existing `POST /csdp/webhooks/{loan,recovery}` routes stay live
 * for internal use — this controller is purely the Airtel ingress.
 */
@Controller()
@Public()
@UseGuards(AirtelApiKeyGuard)
export class AirtelWebhookController {
  private readonly log = new Logger(AirtelWebhookController.name);

  constructor(
    private readonly inboundLog: InboundLogService,
    private readonly mapper: AirtelWebhookMapper,
    @InjectQueue('csdp-loan-notifications') private readonly loanQueue: Queue,
    @InjectQueue('csdp-recovery-notifications')
    private readonly recoveryQueue: Queue,
    @InjectMetric(CSDP_METRICS.webhookInboundTotal)
    private readonly counter: Counter,
  ) {}

  @Post('loan-notification')
  @HttpCode(200)
  @Throttle({ default: { limit: 200, ttl: 60_000 } })
  async loanNotification(
    @Body() dto: AirtelLoanWebhookDto,
    @Req() req: any,
  ): Promise<{ success: true }> {
    const internal = this.mapper.mapLoan(dto);
    const inbound = await this.inboundLog.record(
      'loan',
      internal.loan_id,
      dto,
      this.safeHeaders(req),
    );
    await this.loanQueue.add(
      'loan',
      { ...internal, inbound_log_id: inbound.id, source: 'airtel' },
      {
        removeOnComplete: 1000,
        removeOnFail: false,
        attempts: 5,
        backoff: { type: 'exponential', delay: 2000 },
      },
    );
    this.counter.inc({ kind: 'loan', result: 'accepted' });
    return { success: true };
  }

  @Post('recovery-notification')
  @HttpCode(200)
  @Throttle({ default: { limit: 200, ttl: 60_000 } })
  async recoveryNotification(
    @Body() dto: AirtelRecoveryWebhookDto,
    @Req() req: any,
  ): Promise<{ success: true }> {
    const internal = this.mapper.mapRecovery(dto);
    const inbound = await this.inboundLog.record(
      'recovery',
      internal.recovery_id,
      dto,
      this.safeHeaders(req),
    );
    await this.recoveryQueue.add(
      'recovery',
      { ...internal, inbound_log_id: inbound.id, source: 'airtel' },
      {
        removeOnComplete: 1000,
        removeOnFail: false,
        attempts: 5,
        backoff: { type: 'exponential', delay: 2000 },
      },
    );
    this.counter.inc({ kind: 'recovery', result: 'accepted' });
    return { success: true };
  }

  private safeHeaders(req: any): Record<string, any> {
    const safe = { ...req.headers };
    delete safe['authorization'];
    return safe;
  }
}
