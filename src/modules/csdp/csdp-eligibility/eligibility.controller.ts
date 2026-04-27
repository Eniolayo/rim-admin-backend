import {
  Controller,
  Post,
  Body,
  HttpCode,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { DecisionRouterService, DecisionContext, DecisionResult } from './decision-router.service';
import { EligibilityLoggerService } from './eligibility-logger.service';
import { EligibilityRequestDto } from './dto/eligibility-request.dto';
import { Public } from '../../auth/decorators/public.decorator';
import { CsdpApiKeyGuard } from '../../auth/guards/csdp-api-key.guard';
import { CsdpScopes } from '../../auth/decorators/csdp-scopes.decorator';
import { DecisionMode } from '../csdp-feature-flags/csdp-feature-flags.service';
import { toE164Nigerian } from '../../../common/utils/phone.utils';

// TODO: Confirm response shape with Airtel once Teamwee contract is finalised.
// Airtel may expect a plain-text literal "0" rather than JSON { limit: "0" }.
// For Phase 1 we return JSON as a safer NestJS default.
export interface EligibilityResponse {
  limit: string;
}

@Controller('csdp/eligibility')
export class EligibilityController {
  constructor(
    private readonly router: DecisionRouterService,
    private readonly logger: EligibilityLoggerService,
  ) {}

  @Post()
  @Public()
  @UseGuards(CsdpApiKeyGuard)
  @CsdpScopes('csdp:profile')
  @HttpCode(200)
  async eligibility(
    @Body() dto: EligibilityRequestDto,
  ): Promise<EligibilityResponse> {
    const msisdn = toE164Nigerian(dto.msisdn);
    if (!msisdn) throw new BadRequestException('Invalid MSISDN');

    const ctx: DecisionContext = {
      msisdn,
      transRef: dto.trans_ref,
      daKobo: BigInt(dto.da_kobo),
      loanType: dto.loan_type,
      receivedAt: Date.now(),
    };

    // 1500ms hard budget — race the decision against a cutoff
    const result = await Promise.race([
      this.router.decide(ctx),
      new Promise<DecisionResult>((_, rej) =>
        setTimeout(() => rej(new Error('budget_exceeded')), 1500),
      ),
    ]).catch((err: Error) => {
      // Budget exceeded → synthesise a FALLBACK result for logging
      const fallback: DecisionResult = {
        responseLimit: '0',
        teamweeLimitKobo: null,
        rimLimitKobo: null,
        winner: 'FALLBACK',
        decisionMode: 'STUB_DENY' as DecisionMode, // actual mode unknown at cutoff
        teamweeLatencyMs: null,
        rimLatencyMs: null,
        totalLatencyMs: Date.now() - ctx.receivedAt,
        errorReason: err.message ?? 'unknown',
      };
      return fallback;
    });

    // Fire-and-forget — must not throw or delay the response
    void this.logger.enqueue(ctx, result);

    return { limit: result.responseLimit };
  }
}
