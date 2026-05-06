import { Injectable, Logger } from '@nestjs/common';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Histogram } from 'prom-client';
import { FeatureRowReadModel } from '../csdp-linking/feature-row-read-model.service';
import { CSDP_METRICS } from '../csdp-core/metrics/csdp-metrics.module';
import { CsdpScoringConfigLoader } from './csdp-scoring-config.loader';
import {
  scoreV3,
  CsdpFeatureRow,
  CsdpLoanType,
  CsdpScoreResult,
} from './heuristic-v3';

export interface ScoreInputs {
  msisdn: string;
  daKobo: number;
  loanType: CsdpLoanType;
}

export interface ScoreOutput {
  result: CsdpScoreResult;
  features: CsdpFeatureRow;
  systemExposurePct: number;
}

/**
 * Nest service that runs `heuristic_v3` Stages 1–4 against live data:
 *   1. Loads the merged feature row (PG + Redis) via [FeatureRowReadModel].
 *   2. Loads the `csdp.*` config via [CsdpScoringConfigLoader].
 *   3. Reads `system_exposure_pct` from Redis.
 *   4. Calls the pure-fn `scoreV3()` and returns its result unchanged.
 *
 * Phase 2 step 7 — wired in shadow mode (step 8). Customer-visible
 * promotion is Phase 3.
 */
@Injectable()
export class CsdpScoringService {
  private readonly logger = new Logger(CsdpScoringService.name);

  constructor(
    private readonly readModel: FeatureRowReadModel,
    private readonly configLoader: CsdpScoringConfigLoader,
    @InjectMetric(CSDP_METRICS.rimEngineLatencyMs)
    private readonly engineLatency: Histogram<string>,
  ) {}

  async score(inputs: ScoreInputs): Promise<ScoreOutput> {
    const start = Date.now();
    const [features, systemExposurePct, config] = await Promise.all([
      this.readModel.read(inputs.msisdn),
      this.readModel.readSystemExposurePct(),
      this.configLoader.load(),
    ]);

    const result = scoreV3({
      features,
      request: { daKobo: inputs.daKobo, loanType: inputs.loanType },
      systemExposurePct,
      config,
    });

    this.engineLatency.observe(Date.now() - start);
    return { result, features, systemExposurePct };
  }
}
