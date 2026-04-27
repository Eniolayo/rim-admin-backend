import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CsdpSubscriber } from '../../../entities/csdp/csdp-subscriber.entity';
import { CsdpEligibilityLog } from '../../../entities/csdp/csdp-eligibility-log.entity';
import { CsdpLoan } from '../../../entities/csdp/csdp-loan.entity';
import { CsdpRecovery } from '../../../entities/csdp/csdp-recovery.entity';
import { SubscriberBalanceService } from './subscriber-balance.service';
import { toE164Nigerian } from '../../../common/utils/phone.utils';

export interface InvestigateResult {
  msisdn: string;
  subscriber: CsdpSubscriber | null;
  outstandingKobo: string;
  recentEligibility: CsdpEligibilityLog[];
  recentLoans: CsdpLoan[];
  recentRecoveries: CsdpRecovery[];
}

@Injectable()
export class CsdpSubscribersService {
  constructor(
    @InjectRepository(CsdpSubscriber, 'csdpHot')
    private readonly subRepo: Repository<CsdpSubscriber>,
    @InjectRepository(CsdpEligibilityLog, 'csdpHot')
    private readonly logRepo: Repository<CsdpEligibilityLog>,
    @InjectRepository(CsdpLoan, 'csdpHot')
    private readonly loanRepo: Repository<CsdpLoan>,
    @InjectRepository(CsdpRecovery, 'csdpHot')
    private readonly recRepo: Repository<CsdpRecovery>,
    private readonly balanceService: SubscriberBalanceService,
  ) {}

  async investigate(
    msisdnRaw: string,
    opts?: { logsLimit?: number; loansLimit?: number },
  ): Promise<InvestigateResult> {
    const msisdn = toE164Nigerian(msisdnRaw);
    if (!msisdn) {
      throw new BadRequestException(`Invalid MSISDN: ${msisdnRaw}`);
    }

    const logsLimit = opts?.logsLimit ?? 20;
    const loansLimit = opts?.loansLimit ?? 10;
    const recoveriesLimit = 10;

    const [subscriber, outstandingKobo, recentEligibility, recentLoans, recentRecoveries] =
      await Promise.all([
        this.subRepo.findOne({ where: { msisdn } }),
        this.balanceService.getOutstandingKobo(msisdn),
        this.logRepo.find({
          where: { msisdn },
          order: { requestedAt: 'DESC' },
          take: logsLimit,
        }),
        this.loanRepo.find({
          where: { msisdn },
          order: { issuedAt: 'DESC' },
          take: loansLimit,
        }),
        this.recRepo.find({
          where: { msisdn },
          order: { recoveredAt: 'DESC' },
          take: recoveriesLimit,
        }),
      ]);

    return {
      msisdn,
      subscriber,
      outstandingKobo: outstandingKobo.toString(),
      recentEligibility,
      recentLoans,
      recentRecoveries,
    };
  }
}
