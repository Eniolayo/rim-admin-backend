import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { CsdpEligibilityLog } from '../../../entities/csdp/csdp-eligibility-log.entity';
import { CsdpIngestBatch } from '../../../entities/csdp/csdp-ingest-batch.entity';
import { CsdpLoan } from '../../../entities/csdp/csdp-loan.entity';
import { CsdpRecovery } from '../../../entities/csdp/csdp-recovery.entity';
import { CsdpSubscriber } from '../../../entities/csdp/csdp-subscriber.entity';
import { CsdpFeatureFlagsService, FLAG_DECISION_MODE } from '../csdp-feature-flags/csdp-feature-flags.service';
import { CsdpSubscribersService, InvestigateResult } from '../csdp-subscribers/csdp-subscribers.service';

export interface CountersResult {
  eligibilityToday: number;
  eligibilityLast15Min: number;
  winnerBreakdown: Record<string, number>;
  loansToday: number;
  recoveriesToday: number;
  decisionMode: string;
  teamweeFallbackRateLast15Min: number;
}

export interface TeamweeHealthResult {
  status: 'OK' | 'DEGRADED' | 'CIRCUIT_OPEN' | 'UNCONFIGURED';
  p50LatencyMs: number;
  p99LatencyMs: number;
  errorRatePct: number;
  sampleWindow: string;
}

export interface QueueDepthResult {
  queue: string;
  waiting: number;
  active: number;
  delayed: number;
  failed: number;
  completed: number;
}

@Injectable()
export class Phase1DashboardService {
  constructor(
    @InjectQueue('csdp-eligibility-log')
    private readonly eligibilityLogQueue: Queue,
    @InjectQueue('csdp-loan-notifications')
    private readonly loanNotificationsQueue: Queue,
    @InjectQueue('csdp-recovery-notifications')
    private readonly recoveryNotificationsQueue: Queue,
    @InjectQueue('csdp-eligibility-linking')
    private readonly eligibilityLinkingQueue: Queue,
    @InjectQueue('csdp-ingest')
    private readonly ingestQueue: Queue,

    @InjectRepository(CsdpEligibilityLog, 'csdpHot')
    private readonly eligibilityLogRepo: Repository<CsdpEligibilityLog>,
    @InjectRepository(CsdpIngestBatch, 'csdpHot')
    private readonly ingestBatchRepo: Repository<CsdpIngestBatch>,
    @InjectRepository(CsdpLoan, 'csdpHot')
    private readonly loanRepo: Repository<CsdpLoan>,
    @InjectRepository(CsdpRecovery, 'csdpHot')
    private readonly recoveryRepo: Repository<CsdpRecovery>,
    @InjectRepository(CsdpSubscriber, 'csdpHot')
    private readonly subscriberRepo: Repository<CsdpSubscriber>,

    private readonly featureFlagsService: CsdpFeatureFlagsService,
    private readonly subscribersService: CsdpSubscribersService,
  ) {}

  async getCounters(): Promise<CountersResult> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000);

    const [
      eligibilityTodayRows,
      eligibilityLast15MinRows,
      loansTodayCount,
      recoveriesTodayCount,
      decisionMode,
    ] = await Promise.all([
      this.eligibilityLogRepo
        .createQueryBuilder('el')
        .select(['el.winner', 'COUNT(*) as cnt'])
        .where('el.requestedAt >= :today', { today })
        .groupBy('el.winner')
        .getRawMany(),
      this.eligibilityLogRepo
        .createQueryBuilder('el')
        .select(['el.winner', 'COUNT(*) as cnt'])
        .where('el.requestedAt >= :fifteenMinAgo', { fifteenMinAgo })
        .groupBy('el.winner')
        .getRawMany(),
      this.loanRepo
        .createQueryBuilder('l')
        .where('l.issuedAt >= :today', { today })
        .getCount(),
      this.recoveryRepo
        .createQueryBuilder('r')
        .where('r.recoveredAt >= :today', { today })
        .getCount(),
      this.featureFlagsService.getString(FLAG_DECISION_MODE, 'STUB_DENY'),
    ]);

    // Aggregate today totals and winner breakdown
    let eligibilityToday = 0;
    const winnerBreakdown: Record<string, number> = { STUB: 0, TEAMWEE: 0, FALLBACK: 0 };
    for (const row of eligibilityTodayRows) {
      const cnt = Number(row.cnt);
      eligibilityToday += cnt;
      const winner: string = row.el_winner ?? row.winner ?? '';
      winnerBreakdown[winner] = (winnerBreakdown[winner] ?? 0) + cnt;
    }

    // Aggregate last-15-min totals for fallback rate
    let eligibilityLast15Min = 0;
    let fallbackLast15Min = 0;
    for (const row of eligibilityLast15MinRows) {
      const cnt = Number(row.cnt);
      eligibilityLast15Min += cnt;
      const winner: string = row.el_winner ?? row.winner ?? '';
      if (winner === 'FALLBACK') {
        fallbackLast15Min += cnt;
      }
    }

    const teamweeFallbackRateLast15Min =
      eligibilityLast15Min > 0
        ? Math.round((fallbackLast15Min / eligibilityLast15Min) * 10000) / 100
        : 0;

    return {
      eligibilityToday,
      eligibilityLast15Min,
      winnerBreakdown,
      loansToday: loansTodayCount,
      recoveriesToday: recoveriesTodayCount,
      decisionMode,
      teamweeFallbackRateLast15Min,
    };
  }

  async getTeamweeHealth(): Promise<TeamweeHealthResult> {
    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000);
    const sampleWindow = 'last 15 minutes';

    const rows = await this.eligibilityLogRepo
      .createQueryBuilder('el')
      .select([
        'el.teamweeLatencyMs as latency',
        'el.errorReason as error_reason',
      ])
      .where('el.requestedAt >= :fifteenMinAgo', { fifteenMinAgo })
      .andWhere("el.decisionMode = 'PROXY'")
      .getRawMany();

    if (rows.length === 0) {
      return {
        status: 'UNCONFIGURED',
        p50LatencyMs: 0,
        p99LatencyMs: 0,
        errorRatePct: 0,
        sampleWindow,
      };
    }

    const latencies = rows
      .map((r) => Number(r.latency))
      .filter((l) => !isNaN(l) && l > 0)
      .sort((a, b) => a - b);

    const errorCount = rows.filter((r) => r.error_reason !== null && r.error_reason !== '').length;
    const errorRatePct = Math.round((errorCount / rows.length) * 10000) / 100;

    const p50 =
      latencies.length > 0
        ? latencies[Math.floor(latencies.length * 0.5)] ?? 0
        : 0;
    const p99 =
      latencies.length > 0
        ? latencies[Math.floor(latencies.length * 0.99)] ?? 0
        : 0;

    let status: TeamweeHealthResult['status'] = 'OK';
    if (errorRatePct >= 50) {
      status = 'CIRCUIT_OPEN';
    } else if (errorRatePct >= 10) {
      status = 'DEGRADED';
    }

    return {
      status,
      p50LatencyMs: p50,
      p99LatencyMs: p99,
      errorRatePct,
      sampleWindow,
    };
  }

  async getQueueDepths(): Promise<QueueDepthResult[]> {
    const queues: Array<{ name: string; queue: Queue }> = [
      { name: 'csdp-eligibility-log', queue: this.eligibilityLogQueue },
      { name: 'csdp-loan-notifications', queue: this.loanNotificationsQueue },
      { name: 'csdp-recovery-notifications', queue: this.recoveryNotificationsQueue },
      { name: 'csdp-eligibility-linking', queue: this.eligibilityLinkingQueue },
      { name: 'csdp-ingest', queue: this.ingestQueue },
    ];

    return Promise.all(
      queues.map(async ({ name, queue }) => {
        const [waiting, active, delayed, failed, completed] = await Promise.all([
          queue.getWaitingCount(),
          queue.getActiveCount(),
          queue.getDelayedCount(),
          queue.getFailedCount(),
          queue.getCompletedCount(),
        ]);
        return { queue: name, waiting, active, delayed, failed, completed };
      }),
    );
  }

  async getRecentBatches(limit = 20): Promise<CsdpIngestBatch[]> {
    return this.ingestBatchRepo.find({
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async investigateMsisdn(msisdn: string): Promise<InvestigateResult> {
    return this.subscribersService.investigate(msisdn);
  }
}
