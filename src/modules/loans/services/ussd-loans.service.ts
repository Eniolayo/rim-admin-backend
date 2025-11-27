import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { User } from '../../../entities/user.entity';
import { Loan, LoanStatus, Network } from '../../../entities/loan.entity';
import {
  UssdLoanOfferRequestDto,
  UssdLoanApproveRequestDto,
  UssdLoanOfferJson,
  UssdLoanApproveJson,
} from '../dto/ussd-loan.dto';
import { CreditScoreService } from '../../credit-score/services/credit-score.service';
import { UssdSessionService, UssdOfferSession } from './ussd-session.service';
import { SystemConfigService } from '../../system-config/services/system-config.service';
import { normalizeNigerianPhone } from '../../../common/utils/phone.utils';
import { UserRepository } from '../../users/repositories/user.repository';
import { RedisService } from '../../../common/redis/redis.service';
import { LoanDisburseQueueService } from './loan-disburse-queue.service';

@Injectable()
export class UssdLoansService {
  constructor(
    private readonly userRepository: UserRepository,
    @InjectRepository(Loan)
    private readonly loanRepository: Repository<Loan>,
    private readonly creditScoreService: CreditScoreService,
    private readonly ussdSessionService: UssdSessionService,
    private readonly systemConfigService: SystemConfigService,
    private readonly redisService: RedisService,
    private readonly loanDisburseQueueService: LoanDisburseQueueService,
    private readonly logger: Logger,
  ) {}

  async handleLoanOffer(
    dto: UssdLoanOfferRequestDto,
  ): Promise<string | UssdLoanOfferJson> {
    const responseType = dto.responseType ?? 'text';

    const normalizedPhone = normalizeNigerianPhone(dto.phoneNumber);

    if (!normalizedPhone) {
      if (responseType === 'json') {
        throw new BadRequestException('phoneNumber is required');
      }
      return this.asError(
        'loan-offer',
        'INVALID_REQUEST',
        'phoneNumber is required',
        responseType,
      );
    }

    const sessionKey = dto.sessionId || normalizedPhone;

    const user = await this.userRepository.findByPhone(normalizedPhone);
    this.logger.log(`${normalizedPhone}, Normalized phone number`);

    if (!user) {
      if (responseType === 'json') {
        throw new NotFoundException('No user found for this phone number');
      }
      return this.asError(
        'loan-offer',
        'USER_NOT_FOUND',
        'No user found for this phone number',
        responseType,
      );
    }

    // Parallelize credit score calculations for better performance
    const [eligibleAmount, interestRate, repaymentPeriod] = await Promise.all([
      this.creditScoreService.calculateEligibleLoanAmount(user.id),
      this.creditScoreService.calculateInterestRateByCreditScore(user.id),
      this.creditScoreService.calculateRepaymentPeriodByCreditScore(user.id),
    ]);

    if (!eligibleAmount || eligibleAmount <= 0) {
      if (responseType === 'json') {
        // Return empty response instead of 404
        const json: UssdLoanOfferJson = {
          status: 'success',
          type: 'loan-offer',
          sessionId: sessionKey,
          phoneNumber: dto.phoneNumber,
          userId: user.id,
          offers: [],
          metadata: {
            eligibleAmount: 0,
            network: dto.network,
          },
        };
        return json;
      }
      return this.asError(
        'loan-offer',
        'NO_ELIGIBLE_AMOUNT',
        'User not eligible for any amount',
        responseType,
      );
    }

    const offers = this.buildOfferBands(
      eligibleAmount,
      interestRate,
      repaymentPeriod,
    );

    if (!offers.length) {
      if (responseType === 'json') {
        // Return empty response instead of 404
        const json: UssdLoanOfferJson = {
          status: 'success',
          type: 'loan-offer',
          sessionId: sessionKey,
          phoneNumber: dto.phoneNumber,
          userId: user.id,
          offers: [],
          metadata: {
            eligibleAmount,
            network: dto.network,
          },
        };
        return json;
      }
      return this.asError(
        'loan-offer',
        'NO_OFFERS',
        'No offers available',
        responseType,
      );
    }

    const sessionPayload: UssdOfferSession = {
      userId: user.id,
      msisdn: dto.phoneNumber,
      eligibleAmount,
      network: dto.network,
      offers,
    };

    await this.ussdSessionService.saveOfferSession(sessionKey, sessionPayload);

    if (responseType === 'json') {
      const json: UssdLoanOfferJson = {
        status: 'success',
        type: 'loan-offer',
        sessionId: sessionKey,
        phoneNumber: dto.phoneNumber,
        userId: user.id,
        offers,
        metadata: {
          eligibleAmount,
          network: dto.network,
        },
      };
      return json;
    }

    const lines: string[] = ['CON You qualify for:'];
    for (const offer of offers) {
      lines.push(`${offer.option}. ${this.formatAmount(offer.amount)}`);
    }
    lines.push(`Select option (1-${offers.length}):`);
    return lines.join('\n');
  }

  async handleLoanApprove(
    dto: UssdLoanApproveRequestDto,
  ): Promise<string | UssdLoanApproveJson> {
    const responseType = dto.responseType ?? 'text';

    const normalizedPhone = normalizeNigerianPhone(dto.phoneNumber);

    if (!normalizedPhone) {
      return this.asApproveError(
        'INVALID_REQUEST',
        'phoneNumber is required',
        dto,
        responseType,
      );
    }

    if (!dto.selectedOption && !dto.selectedAmount) {
      return this.asApproveError(
        'INVALID_REQUEST',
        'Selected option or amount is required',
        dto,
        responseType,
      );
    }

    const user = await this.userRepository.findByPhone(normalizedPhone);

    if (!user) {
      return this.asApproveError(
        'USER_NOT_FOUND',
        'This is not a user.',
        dto,
        responseType,
      );
    }

    const sessionKey = dto.sessionId || normalizedPhone;

    let session = await this.ussdSessionService.getOfferSession(sessionKey);

    if (!session || session.msisdn !== normalizedPhone) {
      const recomputed = await this.recomputeOffersForUser(
        user,
        sessionKey,
        dto.network,
      );
      session = recomputed;
    }

    if (!session.offers.length || session.eligibleAmount <= 0) {
      return this.asApproveError(
        'NO_ELIGIBLE_AMOUNT',
        'User not eligible for any amount',
        dto,
        responseType,
      );
    }

    const amount = this.resolveAmountFromSelection(dto, session);

    if (!amount || amount <= 0) {
      return this.asApproveError(
        'INVALID_SELECTION',
        'Invalid loan selection',
        dto,
        responseType,
      );
    }

    // Validate that the selected amount doesn't exceed the eligible amount
    if (amount > session.eligibleAmount) {
      return this.asApproveError(
        'INVALID_SELECTION',
        'Selected amount exceeds eligible loan amount',
        dto,
        responseType,
      );
    }

    const loan = await this.createOrReuseUssdLoan(user, amount, dto, session);

    // Check if loan is already disbursed (from previous request or concurrent processing)
    const isAlreadyDisbursed = loan.status === LoanStatus.DISBURSED;

    if (!isAlreadyDisbursed) {
      // Enqueue disbursement job only if not already disbursed
      await this.loanDisburseQueueService.enqueue({
        loanId: loan.id, // Database UUID
        userId: loan.userId,
      });
    }

    if (responseType === 'json') {
      const json: UssdLoanApproveJson = {
        status: isAlreadyDisbursed ? 'success' : 'processing',
        type: 'loan-approve',
        sessionId: sessionKey,
        phoneNumber: dto.phoneNumber,
        loan: {
          id: loan.id,
          loanId: loan.loanId,
          userId: loan.userId,
          amount: Number(loan.amount),
          status: loan.status,
        },
        message: isAlreadyDisbursed
          ? 'Your loan has been disbursed successfully.'
          : 'Your loan is being processed. You will be notified shortly.',
      };
      return json;
    }

    // Text response
    if (isAlreadyDisbursed) {
      return 'END Your loan has been disbursed.';
    }

    return 'END Your loan is being processed. You will be notified shortly.';
  }

  private buildOfferBands(
    eligibleAmount: number,
    interestRate: number,
    repaymentPeriod: number,
  ): UssdOfferSession['offers'] {
    // Ensure eligibleAmount is valid
    if (!eligibleAmount || eligibleAmount <= 0) {
      return [];
    }

    const rawAmounts = [
      Math.round(eligibleAmount * 0.5),
      Math.round(eligibleAmount * 0.75),
      Math.round(eligibleAmount),
    ];

    // Filter out invalid amounts and ensure none exceed eligible amount
    const validAmounts = Array.from(new Set(rawAmounts))
      .filter((a) => a > 0)
      .map((a) => Math.min(a, eligibleAmount)) // Cap at eligible amount
      .filter((a) => a > 0); // Remove any that became 0 after capping

    // Sort amounts in ascending order for better UX
    validAmounts.sort((a, b) => a - b);

    return validAmounts.map((amount, idx) => ({
      option: idx + 1,
      amount,
      currency: 'NGN',
      interestRate,
      repaymentPeriodDays: repaymentPeriod,
    }));
  }

  private formatAmount(amount: number): string {
    return new Intl.NumberFormat('en-NG', {
      maximumFractionDigits: 0,
    }).format(amount);
  }

  private asError(
    type: 'loan-offer',
    code: string,
    message: string,
    responseType: 'text' | 'json',
  ): string | UssdLoanOfferJson {
    if (responseType === 'json') {
      return {
        status: 'error',
        type,
        code,
        message,
        sessionId: '',
        phoneNumber: '',
      };
    }

    if (code === 'INVALID_REQUEST') {
      return 'END Invalid request.';
    }

    return 'END Sorry, you are not eligible for a loan at this time.';
  }

  private asApproveError(
    code: string,
    message: string,
    dto: UssdLoanApproveRequestDto,
    responseType: 'text' | 'json',
  ): string | UssdLoanApproveJson {
    if (responseType === 'json') {
      return {
        status: 'error',
        type: 'loan-approve',
        sessionId: dto.sessionId || '',
        phoneNumber: dto.phoneNumber || '',
        code,
        message,
      };
    }

    if (code === 'INVALID_REQUEST') {
      return 'END Invalid request.';
    }

    if (code === 'INVALID_SELECTION') {
      return 'END Invalid selection.';
    }

    if (code === 'USER_NOT_FOUND') {
      return 'END This is not a user.';
    }

    return 'END You are not eligible for a loan at this time.';
  }

  private async recomputeOffersForUser(
    user: User,
    sessionId: string,
    network: Network,
  ): Promise<UssdOfferSession> {
    const eligibleAmount =
      await this.creditScoreService.calculateEligibleLoanAmount(user.id);
    const interestRate =
      await this.creditScoreService.calculateInterestRateByCreditScore(user.id);
    const repaymentPeriod =
      await this.creditScoreService.calculateRepaymentPeriodByCreditScore(
        user.id,
      );

    const offers = this.buildOfferBands(
      eligibleAmount,
      interestRate,
      repaymentPeriod,
    );

    const session: UssdOfferSession = {
      userId: user.id,
      msisdn: user.phone || '',
      eligibleAmount,
      network,
      offers,
    };

    await this.ussdSessionService.saveOfferSession(sessionId, session);
    return session;
  }

  private resolveAmountFromSelection(
    dto: UssdLoanApproveRequestDto,
    session: UssdOfferSession,
  ): number | undefined {
    if (dto.selectedOption) {
      const idx = Number(dto.selectedOption) - 1;
      if (Number.isNaN(idx) || idx < 0 || idx >= session.offers.length) {
        return undefined;
      }
      const amount = session.offers[idx].amount;
      // Ensure the amount from the offer doesn't exceed eligible amount
      return amount <= session.eligibleAmount ? amount : undefined;
    }

    if (dto.selectedAmount) {
      const requestedAmount = Number(dto.selectedAmount);
      const match = session.offers.find((o) => o.amount === requestedAmount);
      if (match && match.amount <= session.eligibleAmount) {
        return match.amount;
      }
    }

    return undefined;
  }

  private async createOrReuseUssdLoan(
    user: User,
    amount: number,
    dto: UssdLoanApproveRequestDto,
    session: UssdOfferSession,
  ): Promise<Loan> {
    const sessionKey = dto.sessionId || dto.phoneNumber;
    const normalizedPhone = normalizeNigerianPhone(dto.phoneNumber);

    // Build a robust idempotency key
    const idempotencyKey = this.buildIdempotencyKey(
      user.id,
      sessionKey,
      amount,
    );

    // 1. Check for existing loan using idempotency key (with Redis cache)
    const existingLoan = await this.findLoanByIdempotencyKey(
      user.id,
      idempotencyKey,
    );

    if (existingLoan) {
      this.logger.log(
        `Found existing loan ${existingLoan.loanId} for idempotency key: ${idempotencyKey}`,
      );
      return existingLoan;
    }

    // 2. Check for recently created loans (within last 2 hours) for same phone number
    if (normalizedPhone) {
      const recentLoan = await this.findRecentLoanForPhoneNumber(
        normalizedPhone,
        2 * 60, // 2 hours in minutes
      );
      if (recentLoan) {
        this.logger.warn(
          `Phone number ${normalizedPhone} attempted to create loan within 2 hours of previous loan ${recentLoan.loanId}`,
        );
        throw new BadRequestException(
          'You have recently created a loan. Please wait 2 hours before requesting another loan.',
        );
      }
    }

    // 3. Acquire distributed lock to prevent concurrent requests
    const lockKey = `ussd:loan:lock:${user.id}:${sessionKey}`;
    const lockAcquired = await this.acquireLock(lockKey, 30); // 30 seconds TTL

    if (!lockAcquired) {
      this.logger.warn(
        `Could not acquire lock for user ${user.id}, session ${sessionKey}. Another request may be processing.`,
      );
      throw new BadRequestException(
        'A loan request is already being processed. Please wait.',
      );
    }

    try {
      // 4. Double-check after acquiring lock (another request might have created it)
      const doubleCheckLoan = await this.findLoanByIdempotencyKey(
        user.id,
        idempotencyKey,
      );
      if (doubleCheckLoan) {
        this.logger.log(
          `Loan was created by concurrent request: ${doubleCheckLoan.loanId}`,
        );
        return doubleCheckLoan;
      }

      // 5. Validate credit limits and active loans - parallelize calculations
      const [interestRate, repaymentPeriod, activeLoansResult] =
        await Promise.all([
          this.creditScoreService.calculateInterestRateByCreditScore(user.id),
          this.creditScoreService.calculateRepaymentPeriodByCreditScore(
            user.id,
          ),
          // Optimized query: only select outstandingAmount for calculation
          this.loanRepository
            .createQueryBuilder('loan')
            .select(['loan.outstandingAmount'])
            .where('loan.userId = :userId', { userId: user.id })
            .andWhere('loan.status IN (:...statuses)', {
              statuses: [
                LoanStatus.DISBURSED,
                LoanStatus.REPAYING,
                LoanStatus.DEFAULTED,
              ],
            })
            .getMany(),
        ]);

      const userCreditLimit = Number(user.creditLimit);
      if (amount > userCreditLimit) {
        throw new BadRequestException(
          `Loan amount exceeds user's credit limit. Maximum allowed: ${userCreditLimit}, Requested: ${amount}`,
        );
      }

      const totalOutstanding = activeLoansResult.reduce(
        (sum, loan) => sum + Number(loan.outstandingAmount),
        0,
      );

      const totalAfterNewLoan = totalOutstanding + amount;
      if (totalAfterNewLoan > userCreditLimit) {
        const availableCredit = Math.max(0, userCreditLimit - totalOutstanding);
        throw new BadRequestException(
          `Cannot create loan. User has already borrowed ${totalOutstanding} and has a credit limit of ${userCreditLimit}. ` +
            `Requested loan amount ${amount} would exceed the limit. ` +
            `Available credit: ${availableCredit}. User must repay existing loans before borrowing more.`,
        );
      }

      // 6. Create loan with idempotency key in metadata
      const interest = (amount * interestRate) / 100;
      const disbursedAmount = amount - interest;
      const amountDue = amount;
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + repaymentPeriod);

      const loanId = await this.generateLoanId();

      const loanKey = this.buildLoanKey(sessionKey, dto.phoneNumber, amount);

      const loan = this.loanRepository.create({
        loanId,
        userId: user.id,
        amount,
        disbursedAmount,
        interestRate,
        repaymentPeriod,
        userPhone: user.phone,
        userEmail: user.email,
        amountDue,
        amountPaid: 0,
        outstandingAmount: amountDue,
        dueDate,
        status: LoanStatus.APPROVED,
        network: session.network as Network,
        metadata: {
          ...(session.network ? { network: session.network } : {}),
          idempotencyKey, // Store idempotency key
          loanKey, // Keep for backward compatibility
          sessionKey, // Store sessionKey for later invalidation after disbursement
          channel: 'USSD',
        },
        telcoReference: `TELCO-REF-${Date.now()}`,
      });

      const saved = await this.loanRepository.save(loan);

      // 7. Session will be invalidated after disbursement completes (see LoanDisburseProcessor)
      // Do not invalidate here to allow retry if disbursement fails

      // 8. Store idempotency key in Redis for fast lookup (5 minutes TTL)
      await this.storeIdempotencyMapping(idempotencyKey, saved.id, 300);

      return saved;
    } finally {
      // Always release the lock
      await this.releaseLock(lockKey);
    }
  }

  private buildLoanKey(
    sessionKey: string | undefined,
    phoneNumber: string,
    amount: number,
  ): string {
    const parts = [sessionKey, phoneNumber, String(amount)].filter(
      (p) => !!p,
    ) as string[];
    return parts.join(':');
  }

  private async generateLoanId(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.loanRepository
      .createQueryBuilder('loan')
      .where('loan.loanId LIKE :pattern', { pattern: `USS-${year}-%` })
      .getCount();
    const sequence = String(count + 1).padStart(3, '0');
    return `USS-${year}-${sequence}`;
  }

  /**
   * Build a robust idempotency key for loan creation
   */
  private buildIdempotencyKey(
    userId: string,
    sessionKey: string,
    amount: number,
  ): string {
    // Normalize amount to prevent floating point issues
    const normalizedAmount = Math.round(amount * 100) / 100;
    return `ussd:loan:${userId}:${sessionKey}:${normalizedAmount}`;
  }

  /**
   * Find loan by idempotency key (with Redis cache for fast lookup)
   * Optimized: Select only necessary fields
   */
  private async findLoanByIdempotencyKey(
    userId: string,
    idempotencyKey: string,
  ): Promise<Loan | null> {
    // Try Redis first (fast path)
    const cachedLoanId = await this.redisService.get(
      `idempotency:${idempotencyKey}`,
    );
    if (cachedLoanId) {
      const loan = await this.loanRepository.findOne({
        where: { id: cachedLoanId },
        select: ['id', 'loanId', 'userId', 'amount', 'status', 'createdAt'],
      });
      if (loan && loan.userId === userId) {
        return loan;
      }
    }

    // Fallback to database query using JSONB - optimized with select
    const loans = await this.loanRepository
      .createQueryBuilder('loan')
      .select([
        'loan.id',
        'loan.loanId',
        'loan.userId',
        'loan.amount',
        'loan.status',
        'loan.createdAt',
      ])
      .where('loan.userId = :userId', { userId })
      .andWhere("loan.metadata->>'idempotencyKey' = :idempotencyKey", {
        idempotencyKey,
      })
      .orderBy('loan.createdAt', 'DESC')
      .limit(1)
      .getMany();

    return loans.length > 0 ? loans[0] : null;
  }

  /**
   * Find recent loan for phone number within specified minutes
   * Optimized: Only select necessary fields and use getRawOne for existence check
   */
  private async findRecentLoanForPhoneNumber(
    phoneNumber: string,
    minutesAgo: number,
  ): Promise<Loan | null> {
    const cutoffTime = new Date();
    cutoffTime.setMinutes(cutoffTime.getMinutes() - minutesAgo);

    const recentLoan = await this.loanRepository
      .createQueryBuilder('loan')
      .select(['loan.id', 'loan.loanId', 'loan.createdAt', 'loan.status'])
      .where('loan.userPhone = :phoneNumber', { phoneNumber })
      .andWhere('loan.createdAt >= :cutoffTime', { cutoffTime })
      .andWhere('loan.status IN (:...statuses)', {
        statuses: [
          LoanStatus.APPROVED,
          LoanStatus.DISBURSED,
          LoanStatus.PENDING,
          LoanStatus.REPAYING,
        ],
      })
      .orderBy('loan.createdAt', 'DESC')
      .limit(1)
      .getOne();

    return recentLoan;
  }

  /**
   * Acquire distributed lock using Redis
   */
  private async acquireLock(key: string, ttlSeconds: number): Promise<boolean> {
    try {
      const redisClient = this.redisService.getClient();
      // Use SET with NX (only set if not exists) and EX (expiration)
      const result = await redisClient.set(key, '1', 'EX', ttlSeconds, 'NX');
      return result === 'OK';
    } catch (error) {
      this.logger.error(
        `Error acquiring lock ${key}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }

  /**
   * Release distributed lock
   */
  private async releaseLock(key: string): Promise<void> {
    try {
      await this.redisService.del(key);
    } catch (error) {
      this.logger.error(
        `Error releasing lock ${key}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Store idempotency key mapping in Redis for fast lookup
   */
  private async storeIdempotencyMapping(
    idempotencyKey: string,
    loanId: string,
    ttlSeconds: number,
  ): Promise<void> {
    try {
      await this.redisService.set(
        `idempotency:${idempotencyKey}`,
        loanId,
        ttlSeconds,
      );
    } catch (error) {
      this.logger.warn(
        `Failed to store idempotency mapping: ${error instanceof Error ? error.message : String(error)}`,
      );
      // Non-critical, continue
    }
  }
}
