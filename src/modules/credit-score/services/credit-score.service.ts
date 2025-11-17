import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../../entities/user.entity';
import { Loan, LoanStatus } from '../../../entities/loan.entity';
import {
  Transaction,
  TransactionType,
  TransactionStatus,
} from '../../../entities/transaction.entity';
import { CreditScoreHistory } from '../../../entities/credit-score-history.entity';
import { CreditScoreHistoryRepository } from '../repositories/credit-score-history.repository';
import { SystemConfigService } from '../../system-config/services/system-config.service';

interface CreditScoreThreshold {
  score: number;
  amount: number;
}

interface RepaymentAmountTier {
  minAmount: number;
  maxAmount: number;
  multiplier: number;
}

interface RepaymentDurationTier {
  minDays: number;
  maxDays: number;
  multiplier: number;
}

interface RepaymentScoringConfig {
  basePoints: number;
  amountMultipliers: RepaymentAmountTier[];
  durationMultipliers: RepaymentDurationTier[];
  maxPointsPerTransaction: number;
  enablePartialRepayments: boolean;
  minPointsForPartialRepayment?: number;
  fullRepaymentBonus?: number;
  fullRepaymentFixedBonus?: number;
}

@Injectable()
export class CreditScoreService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Loan)
    private readonly loanRepository: Repository<Loan>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    private readonly creditScoreHistoryRepository: CreditScoreHistoryRepository,
    private readonly systemConfigService: SystemConfigService,
    private readonly logger: Logger,
  ) {}

  /**
   * Award credit score points when a loan repayment is completed
   * Points are only awarded when the loan is fully repaid
   */
  async awardPointsForRepayment(
    transactionId: string,
    loanId: string,
    phoneNumber?: string | null,
  ): Promise<{ pointsAwarded: number; newScore: number }> {
    this.logger.log(
      { transactionId, loanId, phoneNumber },
      'Processing repayment for credit score',
    );

    // Get transaction
    const transaction = await this.transactionRepository.findOne({
      where: { id: transactionId },
    });

    if (!transaction) {
      throw new NotFoundException(
        `Transaction with ID ${transactionId} not found`,
      );
    }

    // Only process completed repayment transactions
    if (
      transaction.type !== TransactionType.REPAYMENT ||
      transaction.status !== TransactionStatus.COMPLETED
    ) {
      throw new BadRequestException(
        'Transaction must be a completed repayment',
      );
    }

    // Get loan
    const loan = await this.loanRepository.findOne({
      where: { id: loanId },
    });

    if (!loan) {
      throw new NotFoundException(`Loan with ID ${loanId} not found`);
    }

    // Get user - try phone number first if provided, otherwise use transaction.userId
    let user: User | null = null;
    if (phoneNumber) {
      user = await this.userRepository.findOne({
        where: { phone: phoneNumber },
      });
    }
    
    if (!user && transaction.userId) {
      user = await this.userRepository.findOne({
        where: { id: transaction.userId },
      });
    }

    if (!user) {
      throw new NotFoundException(
        `User not found for transaction ${transactionId}`,
      );
    }

    // TypeScript now knows user is User (not null) after the check above

    // Update loan amountPaid and outstandingAmount
    const repaymentAmount = Number(transaction.amount);
    const currentAmountPaid = Number(loan.amountPaid);
    const newAmountPaid = currentAmountPaid + repaymentAmount;
    loan.amountPaid = newAmountPaid;
    loan.outstandingAmount = Number(loan.amountDue) - newAmountPaid;

    // Update loan status
    const wasCompleted = loan.status === LoanStatus.COMPLETED;
    if (loan.outstandingAmount <= 0 && loan.status !== LoanStatus.COMPLETED) {
      loan.status = LoanStatus.COMPLETED;
      loan.completedAt = new Date();
    } else if (loan.status === LoanStatus.DISBURSED) {
      loan.status = LoanStatus.REPAYING;
    }

    await this.loanRepository.save(loan);

    const isFullRepayment = loan.outstandingAmount <= 0;

    const existingByTransaction = await this.creditScoreHistoryRepository
      .findByTransactionId(transactionId);
    if (existingByTransaction.length > 0) {
      const last = existingByTransaction[0];
      this.logger.warn(
        { transactionId },
        'Credit score already awarded for this transaction',
      );
      return { pointsAwarded: last.pointsAwarded, newScore: last.newScore };
    }

    const calculationResult = await this.calculatePointsForRepayment(
      repaymentAmount,
      Number(loan.amountDue),
      loan.disbursedAt || loan.createdAt,
      transaction.reconciledAt || transaction.updatedAt,
      isFullRepayment,
    );

    const points = calculationResult.points;

    if (points <= 0) {
      return { pointsAwarded: 0, newScore: user.creditScore };
    }

    const previousScore = user.creditScore;
    const newScore = previousScore + points;
    user.creditScore = newScore;
    await this.userRepository.save(user);

    const reason = isFullRepayment && !wasCompleted ? 'loan_completed' : 'partial_repayment';

    await this.creditScoreHistoryRepository.create({
      userId: user.id,
      previousScore,
      newScore,
      pointsAwarded: points,
      reason,
      loanId,
      transactionId,
      metadata: calculationResult.metadata,
    });

    this.logger.log(
      {
        userId: user.id,
        loanId,
        transactionId,
        pointsAwarded: points,
        previousScore,
        newScore,
        reason,
      },
      'Credit score awarded for repayment',
    );

    return { pointsAwarded: points, newScore };
  }

  /**
   * Calculate eligible loan amount based on user's credit score
   */
  async calculateEligibleLoanAmount(userId: string): Promise<number> {
    this.logger.debug({ userId }, 'Calculating eligible loan amount');

    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Check if first-time user
    const isFirstTimeUser = !user.totalLoans || user.totalLoans === 0;

    if (isFirstTimeUser) {
      // Get first-time user default amount
      const firstTimeAmount = await this.systemConfigService.getValue<number>(
        'loan',
        'first_time_user_amount',
        500, // Default 500 naira
      );
      this.logger.debug(
        { userId, amount: firstTimeAmount },
        'First-time user, returning default amount',
      );
      return firstTimeAmount;
    }

    // Get thresholds from config
    const thresholdsJson = await this.systemConfigService.getValue<
      CreditScoreThreshold[]
    >('credit_score', 'thresholds', [
      { score: 0, amount: 500 },
      { score: 1000, amount: 1000 },
    ]);

    // Find highest threshold user qualifies for
    const userScore = user.creditScore;
    let eligibleAmount = 500; // Default minimum

    // Sort thresholds by score descending
    const sortedThresholds = [...thresholdsJson].sort(
      (a, b) => b.score - a.score,
    );

    for (const threshold of sortedThresholds) {
      if (userScore >= threshold.score) {
        eligibleAmount = threshold.amount;
        break;
      }
    }

    // Ensure amount doesn't exceed user's credit limit
    const creditLimit = Number(user.creditLimit);
    if (creditLimit > 0 && eligibleAmount > creditLimit) {
      eligibleAmount = creditLimit;
    }

    this.logger.debug(
      { userId, creditScore: userScore, eligibleAmount },
      'Calculated eligible loan amount',
    );

    return eligibleAmount;
  }

  /**
   * Calculate interest rate based on user's credit score
   */
  async calculateInterestRateByCreditScore(userId: string): Promise<number> {
    this.logger.debug({ userId }, 'Calculating interest rate by credit score');

    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Get default interest rate
    const defaultRate = await this.systemConfigService.getValue<number>(
      'loan',
      'interest_rate.default',
      5,
    );

    // Get interest rate tiers from config
    interface InterestRateTier {
      minScore: number;
      maxScore: number;
      rate: number;
    }

    const tiers = await this.systemConfigService.getValue<InterestRateTier[]>(
      'loan',
      'interest_rate.tiers',
      [
        { minScore: 0, maxScore: 500, rate: 10 },
        { minScore: 501, maxScore: 1000, rate: 7 },
        { minScore: 1001, maxScore: 9999, rate: 5 },
      ],
    );

    // Get min/max limits
    const minRate = await this.systemConfigService.getValue<number>(
      'loan',
      'interest_rate.min',
      1,
    );
    const maxRate = await this.systemConfigService.getValue<number>(
      'loan',
      'interest_rate.max',
      20,
    );

    const userScore = user.creditScore;
    let calculatedRate = defaultRate;

    // Find matching tier based on credit score
    for (const tier of tiers) {
      if (userScore >= tier.minScore && userScore <= tier.maxScore) {
        calculatedRate = tier.rate;
        break;
      }
    }

    // Ensure rate is within min/max limits
    if (calculatedRate < minRate) {
      calculatedRate = minRate;
    } else if (calculatedRate > maxRate) {
      calculatedRate = maxRate;
    }

    this.logger.debug(
      {
        userId,
        creditScore: userScore,
        calculatedRate,
      },
      'Calculated interest rate by credit score',
    );

    return calculatedRate;
  }

  /**
   * Calculate repayment period based on user's credit score
   */
  async calculateRepaymentPeriodByCreditScore(userId: string): Promise<number> {
    this.logger.debug(
      { userId },
      'Calculating repayment period by credit score',
    );

    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Get default repayment period
    const defaultPeriod = await this.systemConfigService.getValue<number>(
      'loan',
      'repayment_period.default',
      30,
    );

    // Get repayment period options from config
    interface RepaymentPeriodOption {
      minScore: number;
      maxScore: number;
      period: number;
    }

    const options = await this.systemConfigService.getValue<
      RepaymentPeriodOption[]
    >('loan', 'repayment_period.options', [
      { minScore: 0, maxScore: 500, period: 14 },
      { minScore: 501, maxScore: 1000, period: 30 },
      { minScore: 1001, maxScore: 9999, period: 60 },
    ]);

    // Get min/max limits
    const minPeriod = await this.systemConfigService.getValue<number>(
      'loan',
      'repayment_period.min',
      7,
    );
    const maxPeriod = await this.systemConfigService.getValue<number>(
      'loan',
      'repayment_period.max',
      90,
    );

    const userScore = user.creditScore;
    let calculatedPeriod = defaultPeriod;

    // Find matching option based on credit score
    for (const option of options) {
      if (userScore >= option.minScore && userScore <= option.maxScore) {
        calculatedPeriod = option.period;
        break;
      }
    }

    // Ensure period is within min/max limits
    if (calculatedPeriod < minPeriod) {
      calculatedPeriod = minPeriod;
    } else if (calculatedPeriod > maxPeriod) {
      calculatedPeriod = maxPeriod;
    }

    this.logger.debug(
      {
        userId,
        creditScore: userScore,
        calculatedPeriod,
      },
      'Calculated repayment period by credit score',
    );

    return calculatedPeriod;
  }

  /**
   * Get credit score history for a user
   */
  async getCreditScoreHistory(userId: string): Promise<CreditScoreHistory[]> {
    return this.creditScoreHistoryRepository.findByUserId(userId);
  }

  private async getRepaymentScoringConfig(): Promise<RepaymentScoringConfig> {
    const defaultConfig: RepaymentScoringConfig = {
      basePoints: 50,
      amountMultipliers: [
        { minAmount: 0, maxAmount: 1000, multiplier: 0.5 },
        { minAmount: 1001, maxAmount: 5000, multiplier: 1.0 },
        { minAmount: 5001, maxAmount: 10000, multiplier: 1.5 },
        { minAmount: 10001, maxAmount: 999999, multiplier: 2.0 },
      ],
      durationMultipliers: [
        { minDays: 0, maxDays: 7, multiplier: 2.0 },
        { minDays: 8, maxDays: 14, multiplier: 1.5 },
        { minDays: 15, maxDays: 30, multiplier: 1.0 },
        { minDays: 31, maxDays: 60, multiplier: 0.75 },
        { minDays: 61, maxDays: 999, multiplier: 0.5 },
      ],
      maxPointsPerTransaction: 500,
      enablePartialRepayments: true,
      minPointsForPartialRepayment: 5,
    };

    try {
      const config = await this.systemConfigService.getValue<RepaymentScoringConfig>(
        'credit_score',
        'repayment_scoring',
        defaultConfig,
      );
      return config || defaultConfig;
    } catch {
      this.logger.warn({}, 'Using default repayment scoring config');
      return defaultConfig;
    }
  }

  private getAmountMultiplier(amount: number, tiers: RepaymentAmountTier[]): number {
    const sorted = [...tiers].sort((a, b) => a.minAmount - b.minAmount);
    for (const tier of sorted) {
      if (amount >= tier.minAmount && amount <= tier.maxAmount) return tier.multiplier;
    }
    if (sorted.length > 0) return sorted[sorted.length - 1].multiplier;
    return 1;
  }

  private getDurationMultiplier(days: number, tiers: RepaymentDurationTier[]): number {
    const sorted = [...tiers].sort((a, b) => a.minDays - b.minDays);
    for (const tier of sorted) {
      if (days >= tier.minDays && days <= tier.maxDays) return tier.multiplier;
    }
    if (sorted.length > 0) return sorted[sorted.length - 1].multiplier;
    return 1;
  }

  async calculatePointsForRepayment(
    repaymentAmount: number,
    loanAmount: number,
    disbursedAt: Date,
    repaidAt: Date,
    isFullRepayment: boolean,
  ): Promise<{ points: number; metadata: Record<string, unknown> }> {
    if (!repaymentAmount || repaymentAmount <= 0) {
      return { points: 0, metadata: { repaymentAmount, reason: 'invalid_amount' } };
    }
    
    const config = await this.getRepaymentScoringConfig();
    const amountMultiplier = this.getAmountMultiplier(repaymentAmount, config.amountMultipliers);
    const durationMs = Math.abs(new Date(repaidAt).getTime() - new Date(disbursedAt).getTime());
    const durationDays = Math.floor(durationMs / (1000 * 60 * 60 * 24));
    const durationMultiplier = this.getDurationMultiplier(durationDays, config.durationMultipliers);
    
    let calculatedPoints = config.basePoints * amountMultiplier * durationMultiplier;
    const repaymentPercentage = loanAmount > 0 ? repaymentAmount / loanAmount : 0;
    let finalPoints = calculatedPoints;
    
    if (config.enablePartialRepayments && !isFullRepayment) {
      finalPoints = calculatedPoints * repaymentPercentage;
      if (config.minPointsForPartialRepayment && finalPoints < config.minPointsForPartialRepayment) {
        return {
          points: 0,
          metadata: {
            repaymentAmount,
            loanAmount,
            durationDays,
            amountMultiplier,
            durationMultiplier,
            basePoints: config.basePoints,
            calculatedPoints,
            finalPoints,
            isPartialRepayment: true,
            repaymentPercentage,
            reason: 'below_minimum_threshold',
            minPointsForPartialRepayment: config.minPointsForPartialRepayment,
          },
        };
      }
    }
    
    if (isFullRepayment) {
      if (config.fullRepaymentBonus && config.fullRepaymentBonus > 0) {
        finalPoints = finalPoints * config.fullRepaymentBonus;
      }
      if (config.fullRepaymentFixedBonus && config.fullRepaymentFixedBonus > 0) {
        finalPoints = finalPoints + config.fullRepaymentFixedBonus;
      }
    }
    
    if (config.maxPointsPerTransaction && finalPoints > config.maxPointsPerTransaction) {
      finalPoints = config.maxPointsPerTransaction;
    }
    
    const roundedPoints = Math.round(finalPoints);
    
    return {
      points: roundedPoints,
      metadata: {
        repaymentAmount,
        loanAmount,
        durationDays,
        amountMultiplier,
        durationMultiplier,
        basePoints: config.basePoints,
        calculatedPoints,
        finalPoints: roundedPoints,
        isPartialRepayment: !isFullRepayment,
        repaymentPercentage: !isFullRepayment ? repaymentPercentage : 1,
        fullRepaymentBonus: isFullRepayment && config.fullRepaymentBonus ? config.fullRepaymentBonus : undefined,
        fullRepaymentFixedBonus: isFullRepayment && config.fullRepaymentFixedBonus ? config.fullRepaymentFixedBonus : undefined,
        capped: config.maxPointsPerTransaction && finalPoints >= config.maxPointsPerTransaction,
      },
    };
  }
}
