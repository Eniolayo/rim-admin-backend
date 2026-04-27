import { Global, Module } from '@nestjs/common';
import {
  makeCounterProvider,
  makeHistogramProvider,
  makeGaugeProvider,
} from '@willsoto/nestjs-prometheus';

/** Injection token constants for CSDP Prometheus metrics. */
export const CSDP_METRICS = {
  profileRequestsTotal: 'csdp_profile_requests_total',
  profileLatencyMs: 'csdp_profile_latency_ms',
  teamweeLatencyMs: 'csdp_teamwee_latency_ms',
  rimEngineLatencyMs: 'csdp_rim_engine_latency_ms',
  queueDepth: 'csdp_queue_depth',
  dlqDepth: 'csdp_dlq_depth',
  ingestRowsTotal: 'csdp_ingest_rows_total',
  webhookInboundTotal: 'csdp_webhook_inbound_total',
} as const;

const CSDP_LATENCY_BUCKETS = [10, 25, 50, 100, 200, 400, 800, 1500];
const CSDP_RIM_BUCKETS = [1, 5, 10, 25, 50, 100];

const providers = [
  makeCounterProvider({
    name: CSDP_METRICS.profileRequestsTotal,
    help: 'Total CSDP profile requests',
    labelNames: ['winner', 'loan_type', 'decision_mode'],
  }),
  makeHistogramProvider({
    name: CSDP_METRICS.profileLatencyMs,
    help: 'CSDP profile end-to-end latency in ms',
    labelNames: ['decision_mode'],
    buckets: CSDP_LATENCY_BUCKETS,
  }),
  makeHistogramProvider({
    name: CSDP_METRICS.teamweeLatencyMs,
    help: 'CSDP Teamwee upstream latency in ms',
    labelNames: [],
    buckets: CSDP_LATENCY_BUCKETS,
  }),
  makeHistogramProvider({
    name: CSDP_METRICS.rimEngineLatencyMs,
    help: 'CSDP RIM scoring engine latency in ms',
    labelNames: [],
    buckets: CSDP_RIM_BUCKETS,
  }),
  makeGaugeProvider({
    name: CSDP_METRICS.queueDepth,
    help: 'CSDP queue depth',
    labelNames: ['queue'],
  }),
  makeGaugeProvider({
    name: CSDP_METRICS.dlqDepth,
    help: 'CSDP dead-letter queue depth',
    labelNames: ['queue'],
  }),
  makeCounterProvider({
    name: CSDP_METRICS.ingestRowsTotal,
    help: 'Total CSDP ingest rows processed',
    labelNames: ['source', 'status'],
  }),
  makeCounterProvider({
    name: CSDP_METRICS.webhookInboundTotal,
    help: 'Total CSDP inbound webhook calls',
    labelNames: ['kind', 'result'],
  }),
];

@Global()
@Module({
  providers,
  exports: providers,
})
export class CsdpMetricsModule {}
