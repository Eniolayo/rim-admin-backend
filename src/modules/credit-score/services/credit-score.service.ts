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
  ): Promise<{ pointsAwarded: number; newScore: number }> {
    this.logger.log(
      { transactionId, loanId },
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

    // Get user
    const user = await this.userRepository.findOne({
      where: { id: transaction.userId },
    });

    if (!user) {
      throw new NotFoundException(
        `User with ID ${transaction.userId} not found`,
      );
    }

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

    // Only award points if loan is now fully repaid and wasn't completed before
    if (loan.outstandingAmount <= 0 && !wasCompleted) {
      // Check if points already awarded for this loan (idempotency)
      const existingHistory = await this.creditScoreHistoryRepository
        .findByLoanId(loanId)
        .then((histories) =>
          histories.find((h) => h.reason === 'loan_completed'),
        );

      if (existingHistory) {
        this.logger.warn(
          { loanId },
          'Credit score already awarded for this loan',
        );
        return {
          pointsAwarded: existingHistory.pointsAwarded,
          newScore: existingHistory.newScore,
        };
      }

      // Get points per loan completion from config
      // Default: 100 points per completed loan
      const pointsPerCompletion =
        await this.systemConfigService.getValue<number>(
          'credit_score',
          'points_per_loan_completion',
          100,
        );

      // Award points
      const previousScore = user.creditScore;
      const newScore = previousScore + pointsPerCompletion;
      user.creditScore = newScore;

      await this.userRepository.save(user);

      // Create history record
      await this.creditScoreHistoryRepository.create({
        userId: user.id,
        previousScore,
        newScore,
        pointsAwarded: pointsPerCompletion,
        reason: 'loan_completed',
        loanId,
        transactionId,
      });

      this.logger.log(
        {
          userId: user.id,
          loanId,
          transactionId,
          pointsAwarded: pointsPerCompletion,
          previousScore,
          newScore,
        },
        'Credit score awarded for completed loan',
      );

      return {
        pointsAwarded: pointsPerCompletion,
        newScore,
      };
    }

    // Loan not fully repaid yet, no points awarded
    this.logger.debug(
      {
        loanId,
        outstandingAmount: loan.outstandingAmount,
        wasCompleted,
      },
      'Loan not fully repaid, no points awarded',
    );

    return {
      pointsAwarded: 0,
      newScore: user.creditScore,
    };
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
}
