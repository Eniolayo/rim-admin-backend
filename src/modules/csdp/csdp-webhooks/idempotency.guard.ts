import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CsdpLoan } from '../../../entities/csdp/csdp-loan.entity';
import { CsdpRecovery } from '../../../entities/csdp/csdp-recovery.entity';
import { WEBHOOK_KIND_KEY } from './webhook-kind.decorator';

@Injectable()
export class IdempotencyGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectRepository(CsdpLoan, 'csdpHot')
    private readonly loanRepo: Repository<CsdpLoan>,
    @InjectRepository(CsdpRecovery, 'csdpHot')
    private readonly recoveryRepo: Repository<CsdpRecovery>,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const kind = this.reflector.getAllAndOverride<'loan' | 'recovery'>(
      WEBHOOK_KIND_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );

    // If no kind metadata, skip idempotency check
    if (!kind) return true;

    const req = ctx.switchToHttp().getRequest();
    const body = req.body ?? {};

    if (kind === 'loan') {
      const loanId: string | undefined = body.loan_id;
      if (!loanId) {
        throw new BadRequestException('missing id');
      }
      const existing = await this.loanRepo.findOne({
        where: { loanId },
        select: ['loanId'],
      });
      if (existing) {
        req.duplicateOf = { loan_id: loanId };
      }
    } else {
      const recoveryId: string | undefined = body.recovery_id;
      if (!recoveryId) {
        throw new BadRequestException('missing id');
      }
      const existing = await this.recoveryRepo.findOne({
        where: { recoveryId },
        select: ['recoveryId'],
      });
      if (existing) {
        req.duplicateOf = { recovery_id: recoveryId };
      }
    }

    return true;
  }
}
