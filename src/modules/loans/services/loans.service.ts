import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { LoanRepository } from '../repositories/loan.repository';
import { UserRepository } from '../../users/repositories/user.repository';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QueryFailedError } from 'typeorm';
import {
  CreateLoanDto,
  UpdateLoanDto,
  ApproveLoanDto,
  RejectLoanDto,
  LoanResponseDto,
  LoanStatsDto,
  LoanQueryDto,
  PerformanceReportResponseDto,
} from '../dto';
import { PaginatedResponseDto } from '../../users/dto/paginated-response.dto';
import { Loan, LoanStatus, Network } from '../../../entities/loan.entity';
import { AdminUser } from '../../../entities/admin-user.entity';
import { User } from '../../../entities/user.entity';
import { LoansCacheService } from './loans-cache.service';

@Injectable()
export class LoansService {
  constructor(
    private readonly loanRepository: LoanRepository,
    private readonly userRepository: UserRepository,
    @InjectRepository(Loan)
    private readonly repository: Repository<Loan>,
    @InjectRepository(User)
    private readonly userEntityRepository: Repository<User>,
    private readonly cacheService: LoansCacheService,
    private readonly logger: Logger,
  ) {}

  async create(
    createLoanDto: CreateLoanDto,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _adminUser: AdminUser,
  ): Promise<LoanResponseDto> {
    this.logger.log('Creating new loan');

    try {
      // Load user without loans relation to avoid relationship sync issues
      const user = await this.userEntityRepository.findOne({
        where: { userId: createLoanDto.userId },
      });
      if (!user) {
        throw new NotFoundException(
          `User with ID ${createLoanDto.userId} not found`,
        );
      }

      // Validate user has required fields
      if (!user.phone) {
        throw new BadRequestException(
          `User with ID ${createLoanDto.userId} is missing required phone number. Please update the user profile first.`,
        );
      }

      // Validate loan amount does not exceed user's credit limit
      const userCreditLimit = Number(user.creditLimit);
      if (createLoanDto.amount > userCreditLimit) {
        throw new BadRequestException(
          `Loan amount exceeds user's credit limit. Maximum allowed: ${userCreditLimit}, Requested: ${createLoanDto.amount}`,
        );
      }

      // Generate loanId
      const loanId = await this.generateLoanId();

      // Calculate amounts
      const interest = (createLoanDto.amount * createLoanDto.interestRate) / 100;
      const amountDue = createLoanDto.amount + interest;
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + createLoanDto.repaymentPeriod);
      this.logger.log(`User business ID: ${user.userId}, User UUID: ${user.id}`);

      const loan = this.repository.create({
        loanId,
        userId: user.id,  // Use UUID (primary key), not the business userId field
        amount: createLoanDto.amount,
        network: createLoanDto.network,
        interestRate: createLoanDto.interestRate,
        repaymentPeriod: createLoanDto.repaymentPeriod,
        userPhone: user.phone,
        userEmail: user.email,
        amountDue,
        amountPaid: 0,
        outstandingAmount: amountDue,
        dueDate,
        status: LoanStatus.PENDING,
        metadata: createLoanDto.metadata || null,
      });

      const savedLoan = await this.loanRepository.save(loan);

      // Update user's total loans count using update to avoid relationship sync
      const userLoans = await this.loanRepository.findByUserId(user.id);
      await this.userRepository.update(user.id, {
        totalLoans: userLoans.length,
      });

      this.logger.log({ loanId: savedLoan.loanId }, 'Loan created');

      // Invalidate cache - list and stats changed
      try {
        await Promise.all([
          this.cacheService.invalidateLoanList(),
          this.cacheService.invalidateLoanStats(),
        ]);
      } catch (error) {
        // Cache invalidation error - log but don't fail
        this.logger.warn(
          { error: error instanceof Error ? error.message : String(error), loanId: savedLoan.loanId },
          'Error invalidating cache after loan creation',
        );
      }

      return this.mapToResponse(savedLoan);
    } catch (error) {
      // Re-throw HTTP exceptions (BadRequestException, NotFoundException, etc.)
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      // Handle database constraint violations from TypeORM
      if (error instanceof QueryFailedError) {
        const dbError = error as QueryFailedError & { code?: string; message?: string };
        
        // Log the actual database error for debugging
        this.logger.error(
          { 
            error: dbError.message, 
            code: dbError.code,
            userId: createLoanDto.userId 
          },
          'Database error creating loan',
        );
        
        if (dbError.code === '23502') {
          // NOT NULL constraint violation - extract which column is missing
          const columnMatch = dbError.message?.match(/column "(\w+)"/i);
          const columnName = columnMatch ? columnMatch[1] : 'unknown';
          
          throw new BadRequestException(
            `Loan could not be created due to missing required field: ${columnName}. Please check the user data and try again.`,
          );
        }
        
        if (dbError.code === '23505') {
          // Unique constraint violation
          this.logger.error(
            { error: dbError.message, userId: createLoanDto.userId },
            'Error creating loan: duplicate loanId or constraint violation',
          );
          throw new BadRequestException(
            'Loan could not be created due to a duplicate entry. Please try again.',
          );
        }
        if (dbError.code === '23503') {
          // Foreign key constraint violation
          this.logger.error(
            { error: dbError.message, userId: createLoanDto.userId },
            'Error creating loan: foreign key constraint violation',
          );
          throw new BadRequestException(
            'Loan could not be created due to invalid user reference.',
          );
        }
        
        if (dbError.code === '22P02') {
          // Invalid UUID format
          this.logger.error(
            { error: dbError.message, userId: createLoanDto.userId },
            'Error creating loan: invalid UUID format',
          );
          throw new BadRequestException(
            'Loan could not be created due to invalid user ID format. Please ensure the user exists and try again.',
          );
        }
      }

      // Handle other database errors
      if (error && typeof error === 'object' && 'code' in error) {
        const dbError = error as { code: string; message?: string };
        if (['23505', '23503', '23502'].includes(dbError.code)) {
          this.logger.error(
            { error: dbError.message || 'Database constraint violation', userId: createLoanDto.userId },
            'Error creating loan: database constraint violation',
          );
          throw new BadRequestException(
            'Loan could not be created due to a database constraint violation. Please check the provided data.',
          );
        }
      }

      // Log unexpected errors with full context
      this.logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          userId: createLoanDto.userId,
          amount: createLoanDto.amount,
        },
        'Unexpected error creating loan',
      );

      // Throw internal server error for unexpected exceptions
      throw new InternalServerErrorException(
        'An unexpected error occurred while creating the loan. Please try again later or contact support.',
      );
    }
  }

  async findAll(
    queryDto?: LoanQueryDto,
  ): Promise<PaginatedResponseDto<LoanResponseDto>> {
    this.logger.debug('Finding all loans');

    try {
      // Validate query parameters
      if (queryDto?.page !== undefined && queryDto.page < 1) {
        throw new BadRequestException('Page number must be at least 1');
      }
      if (queryDto?.limit !== undefined && (queryDto.limit < 1 || queryDto.limit > 100)) {
        throw new BadRequestException('Limit must be between 1 and 100');
      }

      // Try to get from cache
      try {
        const cached = await this.cacheService.getLoanList(queryDto);
        if (cached) {
          return cached;
        }
      } catch (error) {
        // Cache error - fallback to database
        this.logger.warn(
          { error: error instanceof Error ? error.message : String(error) },
          'Cache error, falling back to database',
        );
      }

      // If no filters provided, use default pagination
      if (!queryDto || Object.keys(queryDto).length === 0) {
        const [loans, total] = await this.loanRepository.findWithFilters({
          page: 1,
          limit: 10,
        });

        const result = {
          data: loans.map((loan) => this.mapToResponse(loan)),
          total,
          page: 1,
          limit: 10,
          totalPages: Math.ceil(total / 10),
        };

        // Cache the result
        try {
          await this.cacheService.setLoanList(undefined, result);
        } catch (error) {
          // Cache error - continue without caching
          this.logger.warn(
            { error: error instanceof Error ? error.message : String(error) },
            'Error caching loan list',
          );
        }

        return result;
      }

      const page = queryDto.page ?? 1;
      const limit = queryDto.limit ?? 10;

      const [loans, total] = await this.loanRepository.findWithFilters({
        status: queryDto.status,
        network: queryDto.network,
        search: queryDto.search,
        page,
        limit,
      });

      const result = {
        data: loans.map((loan) => this.mapToResponse(loan)),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };

      // Cache the result
      try {
        await this.cacheService.setLoanList(queryDto, result);
      } catch (error) {
        // Cache error - continue without caching
        this.logger.warn(
          { error: error instanceof Error ? error.message : String(error) },
          'Error caching loan list',
        );
      }

      return result;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        { error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined },
        'Error finding loans',
      );
      throw new BadRequestException('Error retrieving loans');
    }
  }

  async findOne(id: string): Promise<LoanResponseDto> {
    this.logger.debug({ loanId: id }, 'Finding loan');

    try {
      // Try to get from cache
      try {
        const cached = await this.cacheService.getLoan(id);
        if (cached) {
          return cached;
        }
      } catch (error) {
        // Cache error - fallback to database
        this.logger.warn(
          { error: error instanceof Error ? error.message : String(error), loanId: id },
          'Cache error, falling back to database',
        );
      }

      const loan = await this.loanRepository.findById(id);

      if (!loan) {
        throw new NotFoundException(`Loan with ID ${id} not found`);
      }

      const result = this.mapToResponse(loan);

      // Cache the result
      try {
        await this.cacheService.setLoan(id, result);
      } catch (error) {
        // Cache error - continue without caching
        this.logger.warn(
          { error: error instanceof Error ? error.message : String(error), loanId: id },
          'Error caching loan',
        );
      }

      return result;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(
        { error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined, loanId: id },
        'Error finding loan',
      );
      throw new BadRequestException('Error retrieving loan');
    }
  }

  async update(
    id: string,
    updateLoanDto: UpdateLoanDto,
  ): Promise<LoanResponseDto> {
    this.logger.log(`Updating loan: ${id}`);

    const loan = await this.loanRepository.findById(id);

    if (!loan) {
      throw new NotFoundException(`Loan with ID ${id} not found`);
    }

    // Recalculate amounts if amount or interest rate changed
    if (updateLoanDto.amount || updateLoanDto.interestRate) {
      const amount = updateLoanDto.amount ?? Number(loan.amount);
      const interestRate = updateLoanDto.interestRate ?? loan.interestRate;
      const interest = (amount * interestRate) / 100;
      loan.amountDue = amount + interest;
      loan.outstandingAmount = loan.amountDue - Number(loan.amountPaid);
    }

    Object.assign(loan, updateLoanDto);
    const updatedLoan = await this.loanRepository.save(loan);

    this.logger.log({ loanId: updatedLoan.loanId }, 'Loan updated');

    // Invalidate cache - user, list, and stats changed
    try {
      await Promise.all([
        this.cacheService.invalidateLoan(id),
        this.cacheService.invalidateLoanList(),
        this.cacheService.invalidateLoanStats(),
      ]);
    } catch (error) {
      // Cache invalidation error - log but don't fail
      this.logger.warn(
        { error: error instanceof Error ? error.message : String(error), loanId: id },
        'Error invalidating cache after loan update',
      );
    }

    return this.mapToResponse(updatedLoan);
  }

  async approve(
    approveLoanDto: ApproveLoanDto,
    adminUser: AdminUser,
  ): Promise<LoanResponseDto> {
    this.logger.log(`Approving loan: ${approveLoanDto.loanId}`);

    // Validate admin user
    if (!adminUser) {
      this.logger.error('Admin user is null or undefined');
      throw new BadRequestException('Admin user information is required to approve a loan');
    }

    // Validate and extract admin user ID
    const adminUserId = adminUser?.id;
    
    // Log admin user details for debugging
    this.logger.debug({
      adminUserId: adminUserId,
      adminUserEmail: adminUser?.email,
      adminUserUsername: adminUser?.username,
      adminUserKeys: adminUser ? Object.keys(adminUser) : [],
    }, 'Admin user attempting to approve loan');

    if (!adminUserId || typeof adminUserId !== 'string') {
      this.logger.error({
        adminUserId: adminUserId,
        adminUserType: typeof adminUser,
        adminUser: adminUser ? JSON.stringify(adminUser, null, 2) : null,
      }, 'Admin user ID is missing or invalid');
      throw new BadRequestException('Admin user ID is required to approve a loan');
    }

    const loan = await this.loanRepository.findByLoanId(approveLoanDto.loanId);

    if (!loan) {
      throw new NotFoundException(
        `Loan with ID ${approveLoanDto.loanId} not found`,
      );
    }

    if (loan.status !== LoanStatus.PENDING) {
      throw new BadRequestException(`Loan is not in pending status`);
    }

    loan.status = LoanStatus.APPROVED;
    loan.approvedAt = new Date();
    loan.approvedBy = adminUserId;
    loan.updatedAt = new Date();

    // Simulate telco API integration
    loan.telcoReference = `TELCO-REF-${Date.now()}`;

    await this.loanRepository.save(loan);

    // Reload the loan to ensure all fields are correctly persisted
    const updatedLoan = await this.loanRepository.findByLoanId(approveLoanDto.loanId);

    if (!updatedLoan) {
      throw new NotFoundException(
        `Loan with ID ${approveLoanDto.loanId} not found after approval`,
      );
    }

    // Log to verify the approvedBy was set
    this.logger.debug({
      loanId: updatedLoan.loanId,
      approvedBy: updatedLoan.approvedBy,
    }, 'Loan approved with approvedBy set');

    this.logger.log({ loanId: updatedLoan.loanId }, 'Loan approved');

    // Invalidate cache - user, list, and stats changed
    try {
      await Promise.all([
        this.cacheService.invalidateLoan(loan.id),
        this.cacheService.invalidateLoanList(),
        this.cacheService.invalidateLoanStats(),
      ]);
    } catch (error) {
      // Cache invalidation error - log but don't fail
      this.logger.warn(
        { error: error instanceof Error ? error.message : String(error), loanId: approveLoanDto.loanId },
        'Error invalidating cache after loan approval',
      );
    }

    return this.mapToResponse(updatedLoan);
  }

  async reject(
    rejectLoanDto: RejectLoanDto,
    adminUser: AdminUser,
  ): Promise<LoanResponseDto> {
    this.logger.log(`Rejecting loan: ${rejectLoanDto.loanId}`);

    // Validate admin user
    if (!adminUser) {
      this.logger.error('Admin user is null or undefined');
      throw new BadRequestException('Admin user information is required to reject a loan');
    }

    // Validate and extract admin user ID
    const adminUserId = adminUser?.id;
    
    // Log admin user details for debugging
    this.logger.debug({
      adminUserId: adminUserId,
      adminUserEmail: adminUser?.email,
      adminUserUsername: adminUser?.username,
      adminUserKeys: adminUser ? Object.keys(adminUser) : [],
    }, 'Admin user attempting to reject loan');

    if (!adminUserId || typeof adminUserId !== 'string') {
      this.logger.error({
        adminUserId: adminUserId,
        adminUserType: typeof adminUser,
        adminUser: adminUser ? JSON.stringify(adminUser, null, 2) : null,
      }, 'Admin user ID is missing or invalid');
      throw new BadRequestException('Admin user ID is required to reject a loan');
    }

    const loan = await this.loanRepository.findByLoanId(rejectLoanDto.loanId);

    if (!loan) {
      throw new NotFoundException(
        `Loan with ID ${rejectLoanDto.loanId} not found`,
      );
    }

    if (loan.status !== LoanStatus.PENDING) {
      throw new BadRequestException(`Loan is not in pending status`);
    }

    loan.status = LoanStatus.REJECTED;
    loan.rejectedAt = new Date();
    loan.rejectedBy = adminUserId;
    loan.rejectionReason = rejectLoanDto.reason;
    loan.updatedAt = new Date();

    await this.loanRepository.save(loan);

    // Reload the loan to ensure all fields are correctly persisted
    const updatedLoan = await this.loanRepository.findByLoanId(rejectLoanDto.loanId);

    if (!updatedLoan) {
      throw new NotFoundException(
        `Loan with ID ${rejectLoanDto.loanId} not found after rejection`,
      );
    }

    // Log to verify the rejectedBy was set
    this.logger.debug({
      loanId: updatedLoan.loanId,
      rejectedBy: updatedLoan.rejectedBy,
    }, 'Loan rejected with rejectedBy set');

    this.logger.log({ loanId: updatedLoan.loanId }, 'Loan rejected');

    // Invalidate cache - user, list, and stats changed
    try {
      await Promise.all([
        this.cacheService.invalidateLoan(loan.id),
        this.cacheService.invalidateLoanList(),
        this.cacheService.invalidateLoanStats(),
      ]);
    } catch (error) {
      // Cache invalidation error - log but don't fail
      this.logger.warn(
        { error: error instanceof Error ? error.message : String(error), loanId: rejectLoanDto.loanId },
        'Error invalidating cache after loan rejection',
      );
    }

    return this.mapToResponse(updatedLoan);
  }

  async disburse(
    id: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _adminUser: AdminUser,
  ): Promise<LoanResponseDto> {
    this.logger.log(`Disbursing loan: ${id}`);

    // Try to find by ID first, then by loanId (business ID)
    let loan = await this.loanRepository.findById(id);
    if (!loan) {
      loan = await this.loanRepository.findByLoanId(id);
    }

    if (!loan) {
      throw new NotFoundException(`Loan with ID ${id} not found`);
    }

    if (loan.status !== LoanStatus.APPROVED) {
      throw new BadRequestException(
        `Loan must be approved before disbursement`,
      );
    }

    loan.status = LoanStatus.DISBURSED;
    loan.disbursedAt = new Date();
    loan.updatedAt = new Date();

    if (!loan.telcoReference) {
      loan.telcoReference = `TELCO-REF-${Date.now()}`;
    }

    const updatedLoan = await this.loanRepository.save(loan);

    this.logger.log({ loanId: updatedLoan.loanId }, 'Loan disbursed');

    // Invalidate cache - user, list, and stats changed
    try {
      await Promise.all([
        this.cacheService.invalidateLoan(loan.id),
        this.cacheService.invalidateLoanList(),
        this.cacheService.invalidateLoanStats(),
      ]);
    } catch (error) {
      // Cache invalidation error - log but don't fail
      this.logger.warn(
        { error: error instanceof Error ? error.message : String(error), loanId: id },
        'Error invalidating cache after loan disbursement',
      );
    }

    return this.mapToResponse(updatedLoan);
  }

  async remove(id: string): Promise<void> {
    this.logger.log(`Removing loan: ${id}`);

    const loan = await this.loanRepository.findById(id);

    if (!loan) {
      throw new NotFoundException(`Loan with ID ${id} not found`);
    }

    await this.loanRepository.delete(id);

    // Invalidate cache - user, list, and stats changed
    try {
      await Promise.all([
        this.cacheService.invalidateLoan(id),
        this.cacheService.invalidateLoanList(),
        this.cacheService.invalidateLoanStats(),
      ]);
    } catch (error) {
      // Cache invalidation error - log but don't fail
      this.logger.warn(
        { error: error instanceof Error ? error.message : String(error), loanId: id },
        'Error invalidating cache after loan deletion',
      );
    }
  }

  async exportLoans(queryDto?: LoanQueryDto): Promise<LoanResponseDto[]> {
    this.logger.debug('Exporting loans');

    try {
      // Validate query parameters (same as findAll, but no pagination validation)
      // No caching - directly query database

      const loans = await this.loanRepository.findAllForExport({
        status: queryDto?.status,
        network: queryDto?.network,
        search: queryDto?.search,
      });

      return loans.map((loan) => this.mapToResponse(loan));
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        { error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined },
        'Error exporting loans',
      );
      throw new BadRequestException('Error exporting loans');
    }
  }

  async getStats(): Promise<LoanStatsDto> {
    this.logger.debug('Getting loan stats');

    try {
      // Try to get from cache
      try {
        const cached = await this.cacheService.getLoanStats();
        if (cached) {
          return cached;
        }
      } catch (error) {
        // Cache error - fallback to database
        this.logger.warn(
          { error: error instanceof Error ? error.message : String(error) },
          'Cache error, falling back to database',
        );
      }

      const stats = await this.loanRepository.getStats();

      // Cache the result
      try {
        await this.cacheService.setLoanStats(stats);
      } catch (error) {
        // Cache error - continue without caching
        this.logger.warn(
          { error: error instanceof Error ? error.message : String(error) },
          'Error caching loan stats',
        );
      }

      return stats;
    } catch (error) {
      this.logger.error(
        { error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined },
        'Error getting loan stats',
      );
      throw new BadRequestException('Error retrieving loan statistics');
    }
  }

  async getPerformanceReport(
    startDate: string,
    endDate: string,
  ): Promise<PerformanceReportResponseDto> {
    this.logger.debug({ startDate, endDate }, 'Getting performance report');

    try {
      // Parse dates
      const start = new Date(startDate);
      const end = new Date(endDate);

      // Validate dates
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        throw new BadRequestException('Invalid date format');
      }

      if (start > end) {
        throw new BadRequestException('Start date must be before or equal to end date');
      }

      // Get loans in date range
      const loans = await this.loanRepository.getPerformanceReportData(start, end);

      // Calculate totals
      const totalLoans = loans.length;

      const totalDisbursed = loans
        .filter((loan) =>
          [
            LoanStatus.DISBURSED,
            LoanStatus.REPAYING,
            LoanStatus.COMPLETED,
            LoanStatus.DEFAULTED,
          ].includes(loan.status),
        )
        .reduce((sum, loan) => sum + Number(loan.amount), 0);

      const totalRepaid = loans.reduce(
        (sum, loan) => sum + Number(loan.amountPaid),
        0,
      );

      const totalOutstanding = loans.reduce(
        (sum, loan) => sum + Number(loan.outstandingAmount),
        0,
      );

      // Calculate rates
      const completedLoans = loans.filter(
        (loan) => loan.status === LoanStatus.COMPLETED,
      );
      const defaultedLoans = loans.filter(
        (loan) => loan.status === LoanStatus.DEFAULTED,
      );

      const defaultRate =
        completedLoans.length + defaultedLoans.length > 0
          ? (defaultedLoans.length /
              (completedLoans.length + defaultedLoans.length)) *
            100
          : 0;

      const repaymentRate =
        totalDisbursed > 0 ? (totalRepaid / totalDisbursed) * 100 : 0;

      // Calculate average loan amount
      const averageLoanAmount =
        totalLoans > 0
          ? loans.reduce((sum, loan) => sum + Number(loan.amount), 0) / totalLoans
          : 0;

      // Calculate average repayment time (from disbursedAt to completedAt for completed loans)
      const completedLoansWithDates = completedLoans.filter(
        (loan) => loan.disbursedAt && loan.completedAt,
      );
      const averageRepaymentTime =
        completedLoansWithDates.length > 0
          ? completedLoansWithDates.reduce((sum, loan) => {
              const disbursed = new Date(loan.disbursedAt!);
              const completed = new Date(loan.completedAt!);
              const days = Math.ceil(
                (completed.getTime() - disbursed.getTime()) /
                  (1000 * 60 * 60 * 24),
              );
              return sum + days;
            }, 0) / completedLoansWithDates.length
          : 0;

      // Network breakdown
      const networkBreakdown = Object.values(Network).map((network) => {
        const networkLoans = loans.filter((loan) => loan.network === network);
        const networkCompleted = networkLoans.filter(
          (loan) => loan.status === LoanStatus.COMPLETED,
        );
        const networkDefaulted = networkLoans.filter(
          (loan) => loan.status === LoanStatus.DEFAULTED,
        );
        const networkDefaultRate =
          networkCompleted.length + networkDefaulted.length > 0
            ? (networkDefaulted.length /
                (networkCompleted.length + networkDefaulted.length)) *
              100
            : 0;

        return {
          network,
          count: networkLoans.length,
          amount: networkLoans.reduce(
            (sum, loan) => sum + Number(loan.amount),
            0,
          ),
          defaultRate: networkDefaultRate,
        };
      });

      // Status breakdown
      const statusBreakdown = Object.values(LoanStatus).map((status) => {
        const statusLoans = loans.filter((loan) => loan.status === status);
        return {
          status,
          count: statusLoans.length,
          amount: statusLoans.reduce(
            (sum, loan) => sum + Number(loan.amount),
            0,
          ),
        };
      });

      return {
        period: {
          start: startDate,
          end: endDate,
        },
        totalLoans,
        totalDisbursed,
        totalRepaid,
        totalOutstanding,
        defaultRate,
        repaymentRate,
        averageLoanAmount,
        averageRepaymentTime,
        networkBreakdown,
        statusBreakdown,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          startDate,
          endDate,
        },
        'Error getting performance report',
      );
      throw new BadRequestException('Error retrieving performance report');
    }
  }

  private async generateLoanId(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.repository
      .createQueryBuilder('loan')
      .where('loan.loanId LIKE :pattern', { pattern: `LOAN-${year}-%` })
      .getCount();
    const sequence = String(count + 1).padStart(3, '0');
    return `LOAN-${year}-${sequence}`;
  }

  private mapToResponse(loan: Loan): LoanResponseDto {
    return {
      id: loan.id,
      loanId: loan.loanId,
      userId: loan.userId,
      userPhone: loan.userPhone,
      userEmail: loan.userEmail,
      amount: Number(loan.amount),
      status: loan.status,
      network: loan.network,
      interestRate: Number(loan.interestRate),
      repaymentPeriod: loan.repaymentPeriod,
      dueDate: loan.dueDate,
      amountDue: Number(loan.amountDue),
      amountPaid: Number(loan.amountPaid),
      outstandingAmount: Number(loan.outstandingAmount),
      approvedAt: loan.approvedAt,
      approvedBy: loan.approvedBy,
      rejectedAt: loan.rejectedAt,
      rejectedBy: loan.rejectedBy,
      rejectionReason: loan.rejectionReason,
      disbursedAt: loan.disbursedAt,
      completedAt: loan.completedAt,
      defaultedAt: loan.defaultedAt,
      telcoReference: loan.telcoReference,
      metadata: loan.metadata,
      createdAt: loan.createdAt,
      updatedAt: loan.updatedAt,
    };
  }
}
