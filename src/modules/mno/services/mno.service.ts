import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  EligibilityRequestDto,
  EligibilityResponseDto,
  FulfillmentRequestDto,
  FulfillmentResponseDto,
  RepaymentRequestDto,
  RepaymentResponseDto,
  LoanEnquiryRequestDto,
  LoanEnquiryResponseDto,
} from '../dto/mno.dto';
import { User } from '../../../entities/user.entity';
import { Loan, LoanStatus } from '../../../entities/loan.entity';
import {
  Transaction,
  TransactionType,
  TransactionStatus,
  PaymentMethod,
} from '../../../entities/transaction.entity';
import { UserRepository } from '../../users/repositories/user.repository';
import { LoanRepository } from '../../loans/repositories/loan.repository';
import { CreditScoreService } from '../../credit-score/services/credit-score.service';
import { normalizeNigerianPhone } from '../../../common/utils/phone.utils';

@Injectable()
export class MnoService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly loanRepository: LoanRepository,
    private readonly creditScoreService: CreditScoreService,
    @InjectRepository(User)
    private readonly userEntityRepository: Repository<User>,
    @InjectRepository(Loan)
    private readonly loanEntityRepository: Repository<Loan>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    private readonly logger: Logger,
  ) {}

  /**
   * Eligibility API - Determine loan amount for a subscriber
   * MNO Initiated
   */
  async checkEligibility(
    request: EligibilityRequestDto,
  ): Promise<EligibilityResponseDto> {
    this.logger.log(
      { phoneNumber: request.phoneNumber, network: request.network },
      'Processing eligibility check',
    );

    try {
      // Normalize phone number
      const normalizedPhone = normalizeNigerianPhone(request.phoneNumber);
      if (!normalizedPhone) {
        return {
          status: 'error',
          message: `Invalid phone number format: "${request.phoneNumber}"`,
          errorCode: 'INVALID_PHONE_NUMBER',
          requestId: request.requestId,
        };
      }

      // Find user by phone number
      const user = await this.userRepository.findByPhone(normalizedPhone);
      if (!user) {
        return {
          status: 'error',
          message: `Subscriber not found for phone number: ${normalizedPhone}`,
          errorCode: 'SUBSCRIBER_NOT_FOUND',
          requestId: request.requestId,
        };
      }

      // Check if user is active
      if (user.status !== 'active') {
        return {
          status: 'error',
          message: `Subscriber account is ${user.status}`,
          errorCode: 'SUBSCRIBER_INACTIVE',
          requestId: request.requestId,
        };
      }

      // Calculate eligible loan amount based on credit score
      let eligibleAmount: number;
      try {
        eligibleAmount =
          await this.creditScoreService.calculateEligibleLoanAmount(user.id);
        this.logger.log(
          { userId: user.id, eligibleAmount },
          'Calculated eligible loan amount',
        );
      } catch (error) {
        this.logger.error(
          {
            error: error instanceof Error ? error.message : String(error),
            userId: user.id,
          },
          'Error calculating eligible loan amount',
        );
        return {
          status: 'error',
          message: 'Unable to calculate eligible loan amount',
          errorCode: 'CALCULATION_ERROR',
          requestId: request.requestId,
        };
      }

      // Check if user has available credit limit
      const activeLoans = await this.loanRepository.findActiveLoansByUserId(
        user.id,
      );
      const totalOutstanding = activeLoans.reduce(
        (sum, loan) => sum + Number(loan.outstandingAmount || 0),
        0,
      );
      const availableCredit = Math.max(
        0,
        (user.creditLimit || 0) - totalOutstanding,
      );

      // Eligible amount cannot exceed available credit
      const finalEligibleAmount = Math.min(eligibleAmount, availableCredit);

      if (finalEligibleAmount <= 0) {
        return {
          status: 'error',
          message: 'Subscriber has no available credit limit',
          errorCode: 'NO_AVAILABLE_CREDIT',
          requestId: request.requestId,
        };
      }

      return {
        status: 'success',
        message: 'Eligibility check completed successfully',
        eligibleAmount: finalEligibleAmount,
        creditScore: user.creditScore || 0,
        currency: 'NGN',
        requestId: request.requestId,
      };
    } catch (error) {
      this.logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          request,
        },
        'Error processing eligibility check',
      );
      return {
        status: 'error',
        message: 'Internal server error processing eligibility check',
        errorCode: 'INTERNAL_ERROR',
        requestId: request.requestId,
      };
    }
  }

  /**
   * Fulfillment API - Notify lender of loan disbursement
   * MNO Initiated
   */
  async processFulfillment(
    request: FulfillmentRequestDto,
  ): Promise<FulfillmentResponseDto> {
    this.logger.log(
      {
        phoneNumber: request.phoneNumber,
        loanId: request.loanId,
        amount: request.amount,
      },
      'Processing fulfillment notification',
    );

    try {
      // Normalize phone number
      const normalizedPhone = normalizeNigerianPhone(request.phoneNumber);
      if (!normalizedPhone) {
        return {
          status: 'error',
          message: `Invalid phone number format: "${request.phoneNumber}"`,
          errorCode: 'INVALID_PHONE_NUMBER',
          requestId: request.requestId,
        };
      }

      // Find user
      const user = await this.userRepository.findByPhone(normalizedPhone);
      if (!user) {
        return {
          status: 'error',
          message: `Subscriber not found for phone number: ${normalizedPhone}`,
          errorCode: 'SUBSCRIBER_NOT_FOUND',
          requestId: request.requestId,
        };
      }

      // Find loan
      const loan = await this.loanEntityRepository.findOne({
        where: { id: request.loanId, userId: user.id },
      });

      if (!loan) {
        return {
          status: 'error',
          message: `Loan not found or does not belong to subscriber`,
          errorCode: 'LOAN_NOT_FOUND',
          requestId: request.requestId,
        };
      }

      // Validate amount matches loan amount (with small tolerance for rounding)
      const amountDifference = Math.abs(
        Number(request.amount) - Number(loan.amount),
      );
      if (amountDifference > 0.01) {
        this.logger.warn(
          {
            requestedAmount: request.amount,
            loanAmount: loan.amount,
            difference: amountDifference,
          },
          'Fulfillment amount does not match loan amount',
        );
      }

      // Update loan status to disbursed if it's still pending/approved
      if (
        loan.status === LoanStatus.PENDING ||
        loan.status === LoanStatus.APPROVED
      ) {
        loan.status = LoanStatus.DISBURSED;
        loan.disbursedAt = request.disbursedAt
          ? new Date(request.disbursedAt)
          : new Date();
        await this.loanEntityRepository.save(loan);

        this.logger.log(
          { loanId: loan.id, status: loan.status },
          'Loan status updated to disbursed',
        );
      } else if (loan.status === LoanStatus.DISBURSED) {
        // Already disbursed - idempotent operation
        this.logger.log(
          { loanId: loan.id },
          'Loan already disbursed - idempotent fulfillment',
        );
      } else {
        return {
          status: 'error',
          message: `Loan is in ${loan.status} status and cannot be disbursed`,
          errorCode: 'INVALID_LOAN_STATUS',
          requestId: request.requestId,
        };
      }

      return {
        status: 'success',
        message: 'Fulfillment notification processed successfully',
        loanId: loan.id,
        requestId: request.requestId,
      };
    } catch (error) {
      this.logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          request,
        },
        'Error processing fulfillment notification',
      );
      return {
        status: 'error',
        message: 'Internal server error processing fulfillment',
        errorCode: 'INTERNAL_ERROR',
        requestId: request.requestId,
      };
    }
  }

  /**
   * Repayment API - Notify lender of loan repayment
   * MNO Initiated
   */
  async processRepayment(
    request: RepaymentRequestDto,
  ): Promise<RepaymentResponseDto> {
    this.logger.log(
      {
        phoneNumber: request.phoneNumber,
        loanId: request.loanId,
        amount: request.amount,
      },
      'Processing repayment notification',
    );

    try {
      // Normalize phone number
      const normalizedPhone = normalizeNigerianPhone(request.phoneNumber);
      if (!normalizedPhone) {
        return {
          status: 'error',
          message: `Invalid phone number format: "${request.phoneNumber}"`,
          errorCode: 'INVALID_PHONE_NUMBER',
          requestId: request.requestId,
        };
      }

      // Find user
      const user = await this.userRepository.findByPhone(normalizedPhone);
      if (!user) {
        return {
          status: 'error',
          message: `Subscriber not found for phone number: ${normalizedPhone}`,
          errorCode: 'SUBSCRIBER_NOT_FOUND',
          requestId: request.requestId,
        };
      }

      // Find loan
      const loan = await this.loanEntityRepository.findOne({
        where: { id: request.loanId, userId: user.id },
      });

      if (!loan) {
        return {
          status: 'error',
          message: `Loan not found or does not belong to subscriber`,
          errorCode: 'LOAN_NOT_FOUND',
          requestId: request.requestId,
        };
      }

      // Check if loan is in a valid state for repayment
      if (
        loan.status !== LoanStatus.DISBURSED &&
        loan.status !== LoanStatus.REPAYING
      ) {
        return {
          status: 'error',
          message: `Loan is in ${loan.status} status and cannot accept repayments`,
          errorCode: 'INVALID_LOAN_STATUS',
          requestId: request.requestId,
        };
      }

      // Validate repayment amount doesn't exceed outstanding amount
      const outstandingAmount = Number(loan.outstandingAmount || loan.amount);
      const repaymentAmount = Number(request.amount);

      if (repaymentAmount > outstandingAmount) {
        return {
          status: 'error',
          message: `Repayment amount (${repaymentAmount}) exceeds outstanding amount (${outstandingAmount})`,
          errorCode: 'REPAYMENT_AMOUNT_EXCEEDS_OUTSTANDING',
          requestId: request.requestId,
        };
      }

      // Check for duplicate transaction reference (idempotency)
      if (request.transactionReference) {
        const existingTransaction = await this.transactionRepository.findOne({
          where: {
            reference: request.transactionReference,
            type: TransactionType.REPAYMENT,
          },
        });

        if (existingTransaction) {
          this.logger.log(
            { transactionReference: request.transactionReference },
            'Duplicate transaction reference detected - returning existing transaction',
          );
          return {
            status: 'success',
            message: 'Repayment already processed',
            transactionId: existingTransaction.id,
            loanId: loan.id,
            outstandingAmount: Number(loan.outstandingAmount || loan.amount),
            requestId: request.requestId,
          };
        }
      }

      // Generate transaction ID
      const transactionId = `MNO-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      // Create repayment transaction
      const transaction = this.transactionRepository.create({
        transactionId,
        userId: user.id,
        userPhone: user.phone || normalizedPhone,
        userEmail: user.email || null,
        loanId: loan.id,
        type: TransactionType.REPAYMENT,
        amount: repaymentAmount,
        status: TransactionStatus.COMPLETED,
        paymentMethod: PaymentMethod.WALLET, // Using WALLET as closest match for MNO payments
        reference: request.transactionReference || null,
        network: request.network,
        description: `Loan repayment via ${request.network}`,
        metadata: {
          network: request.network,
          repaidAt: request.repaidAt || new Date().toISOString(),
          source: 'mno_webhook',
        },
      });

      const savedTransaction =
        await this.transactionRepository.save(transaction);

      // Update loan amounts
      const currentAmountPaid = Number(loan.amountPaid || 0);
      const newAmountPaid = currentAmountPaid + repaymentAmount;
      const newOutstandingAmount = Math.max(
        0,
        outstandingAmount - repaymentAmount,
      );

      loan.amountPaid = newAmountPaid;
      loan.outstandingAmount = newOutstandingAmount;

      // Update loan status
      if (newOutstandingAmount <= 0) {
        loan.status = LoanStatus.COMPLETED;
      } else {
        loan.status = LoanStatus.REPAYING;
      }

      await this.loanEntityRepository.save(loan);

      // Trigger credit score update (async, won't block response)
      try {
        await this.creditScoreService.awardPointsForRepayment(
          savedTransaction.id,
          loan.id,
          normalizedPhone,
        );
      } catch (error) {
        // Log but don't fail the repayment
        this.logger.warn(
          {
            error: error instanceof Error ? error.message : String(error),
            transactionId: savedTransaction.id,
            loanId: loan.id,
          },
          'Error awarding credit score for repayment (non-blocking)',
        );
      }

      this.logger.log(
        {
          transactionId: savedTransaction.id,
          loanId: loan.id,
          amount: repaymentAmount,
          outstandingAmount: newOutstandingAmount,
        },
        'Repayment processed successfully',
      );

      return {
        status: 'success',
        message: 'Repayment processed successfully',
        transactionId: savedTransaction.id,
        loanId: loan.id,
        outstandingAmount: newOutstandingAmount,
        requestId: request.requestId,
      };
    } catch (error) {
      this.logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          request,
        },
        'Error processing repayment notification',
      );
      return {
        status: 'error',
        message: 'Internal server error processing repayment',
        errorCode: 'INTERNAL_ERROR',
        requestId: request.requestId,
      };
    }
  }

  /**
   * Loan Enquiry API - Check outstanding loan amount
   * Lender Initiated
   */
  async enquiryLoan(
    request: LoanEnquiryRequestDto,
  ): Promise<LoanEnquiryResponseDto> {
    this.logger.log(
      { phoneNumber: request.phoneNumber, network: request.network },
      'Processing loan enquiry',
    );

    try {
      // Normalize phone number
      const normalizedPhone = normalizeNigerianPhone(request.phoneNumber);
      if (!normalizedPhone) {
        return {
          status: 'error',
          message: `Invalid phone number format: "${request.phoneNumber}"`,
          errorCode: 'INVALID_PHONE_NUMBER',
        };
      }

      // Find user
      const user = await this.userRepository.findByPhone(normalizedPhone);
      if (!user) {
        return {
          status: 'error',
          message: `Subscriber not found for phone number: ${normalizedPhone}`,
          errorCode: 'SUBSCRIBER_NOT_FOUND',
        };
      }

      // Find active loans (disbursed, repaying, or overdue)
      const activeLoans = await this.loanRepository.findActiveLoansByUserId(
        user.id,
      );

      // Filter by network if provided
      let filteredLoans = activeLoans;
      if (request.network) {
        filteredLoans = activeLoans.filter(
          (loan) => loan.network === request.network,
        );
      }

      // Map loans to response format
      const loans = filteredLoans.map((loan) => ({
        loanId: loan.loanId,
        amount: Number(loan.amount),
        outstandingAmount: Number(loan.outstandingAmount || loan.amount),
        dueDate: loan.dueDate?.toISOString() || '',
        status: loan.status,
      }));

      // Calculate total outstanding amount
      const totalOutstandingAmount = loans.reduce(
        (sum, loan) => sum + loan.outstandingAmount,
        0,
      );

      return {
        status: 'success',
        message: 'Loan enquiry completed successfully',
        phoneNumber: normalizedPhone,
        loans,
        totalOutstandingAmount,
        currency: 'NGN',
      };
    } catch (error) {
      this.logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          request,
        },
        'Error processing loan enquiry',
      );
      return {
        status: 'error',
        message: 'Internal server error processing loan enquiry',
        errorCode: 'INTERNAL_ERROR',
      };
    }
  }
}
