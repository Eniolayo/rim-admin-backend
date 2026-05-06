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
  linkingProcessorLastSuccess:
    'csdp_eligibility_linking_processor_last_success_timestamp',
  agingJobLagSeconds: 'csdp_aging_job_lag_seconds',
  agingJobRunsTotal: 'csdp_aging_job_runs_total',
  snapshotMismatchTotal: 'csdp_snapshot_mismatch_total',
  configCacheHitsTotal: 'csdp_config_cache_hits_total',
  configCacheTtlExceededTotal: 'csdp_config_cache_ttl_exceeded_total',
  configCacheStaleSeconds: 'csdp_config_cache_stale_seconds',
  retentionRowsDeletedTotal: 'csdp_retention_rows_deleted_total',
  retentionLastSuccess: 'csdp_retention_last_success_timestamp',
  retentionRunsTotal: 'csdp_retention_runs_total',
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
  makeGaugeProvider({
    name: CSDP_METRICS.linkingProcessorLastSuccess,
    help: 'Unix timestamp of the last successful daily linking/materializer run',
    labelNames: [],
  }),
  makeGaugeProvider({
    name: CSDP_METRICS.agingJobLagSeconds,
    help: 'Seconds since the last successful aging job run',
    labelNames: [],
  }),
  makeCounterProvider({
    name: CSDP_METRICS.agingJobRunsTotal,
    help: 'Total CSDP aging job runs',
    labelNames: ['result'],
  }),
  makeCounterProvider({
    name: CSDP_METRICS.snapshotMismatchTotal,
    help: 'Total loan_features_snapshot writes that fell back to live re-materialization',
    labelNames: [],
  }),
  makeCounterProvider({
    name: CSDP_METRICS.configCacheHitsTotal,
    help: 'csdp_scoring config cache hits/misses/refreshes',
    labelNames: ['result'],
  }),
  makeCounterProvider({
    name: CSDP_METRICS.configCacheTtlExceededTotal,
    help: 'Number of times the csdp_scoring config cache served stale data past its TTL because SYSTEM_CONFIG was unreadable',
    labelNames: ['outcome'],
  }),
  makeGaugeProvider({
    name: CSDP_METRICS.configCacheStaleSeconds,
    help: 'Seconds since the last successful csdp_scoring config refresh',
    labelNames: [],
  }),
  makeCounterProvider({
    name: CSDP_METRICS.retentionRowsDeletedTotal,
    help: 'Rows deleted by the NDPR retention job, per table',
    labelNames: ['table'],
  }),
  makeGaugeProvider({
    name: CSDP_METRICS.retentionLastSuccess,
    help: 'Unix timestamp of the last successful retention run',
    labelNames: [],
  }),
  makeCounterProvider({
    name: CSDP_METRICS.retentionRunsTotal,
    help: 'Total NDPR retention job runs',
    labelNames: ['result'],
  }),
];

@Global()
@Module({
  providers,
  exports: providers,
})
export class CsdpMetricsModule {}
