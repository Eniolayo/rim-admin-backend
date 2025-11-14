import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { LoanRepository } from '../repositories/loan.repository';
import { UserRepository } from '../../users/repositories/user.repository';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CreateLoanDto,
  UpdateLoanDto,
  ApproveLoanDto,
  RejectLoanDto,
  LoanResponseDto,
  LoanStatsDto,
} from '../dto';
import { Loan, LoanStatus, Network } from '../../../entities/loan.entity';
import { AdminUser } from '../../../entities/admin-user.entity';

@Injectable()
export class LoansService {
  private readonly logger = new Logger(LoansService.name);

  constructor(
    private readonly loanRepository: LoanRepository,
    private readonly userRepository: UserRepository,
    @InjectRepository(Loan)
    private readonly repository: Repository<Loan>,
  ) {}

  async create(
    createLoanDto: CreateLoanDto,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _adminUser: AdminUser,
  ): Promise<LoanResponseDto> {
    this.logger.log('Creating new loan');

    const user = await this.userRepository.findById(createLoanDto.userId);
    if (!user) {
      throw new NotFoundException(
        `User with ID ${createLoanDto.userId} not found`,
      );
    }

    // Generate loanId
    const loanId = await this.generateLoanId();

    // Calculate amounts
    const interest = (createLoanDto.amount * createLoanDto.interestRate) / 100;
    const amountDue = createLoanDto.amount + interest;
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + createLoanDto.repaymentPeriod);

    const loan = this.repository.create({
      ...createLoanDto,
      loanId,
      userId: user.id,
      userPhone: user.phone,
      userEmail: user.email,
      amountDue,
      amountPaid: 0,
      outstandingAmount: amountDue,
      dueDate,
      status: LoanStatus.PENDING,
      metadata: createLoanDto.metadata || {},
    });

    const savedLoan = await this.loanRepository.save(loan);

    // Update user's total loans count
    const userLoans = await this.loanRepository.findByUserId(user.id);
    user.totalLoans = userLoans.length;
    await this.userRepository.save(user);

    this.logger.log(`Loan created: ${savedLoan.loanId}`);

    return this.mapToResponse(savedLoan);
  }

  async findAll(filters?: {
    status?: LoanStatus;
    network?: Network;
    search?: string;
    dateRange?: { from: Date; to: Date };
    amountRange?: { min: number; max: number };
  }): Promise<LoanResponseDto[]> {
    this.logger.debug('Finding all loans');

    const loans = filters
      ? await this.loanRepository.findWithFilters(filters)
      : await this.loanRepository.findAll();

    return loans.map((loan) => this.mapToResponse(loan));
  }

  async findOne(id: string): Promise<LoanResponseDto> {
    this.logger.debug(`Finding loan: ${id}`);

    const loan = await this.loanRepository.findById(id);

    if (!loan) {
      throw new NotFoundException(`Loan with ID ${id} not found`);
    }

    return this.mapToResponse(loan);
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

    this.logger.log(`Loan updated: ${updatedLoan.loanId}`);

    return this.mapToResponse(updatedLoan);
  }

  async approve(
    approveLoanDto: ApproveLoanDto,
    adminUser: AdminUser,
  ): Promise<LoanResponseDto> {
    this.logger.log(`Approving loan: ${approveLoanDto.loanId}`);

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
    loan.approvedBy = adminUser.id;
    loan.updatedAt = new Date();

    // Simulate telco API integration
    loan.telcoReference = `TELCO-REF-${Date.now()}`;

    const updatedLoan = await this.loanRepository.save(loan);

    this.logger.log(`Loan approved: ${updatedLoan.loanId}`);

    return this.mapToResponse(updatedLoan);
  }

  async reject(
    rejectLoanDto: RejectLoanDto,
    adminUser: AdminUser,
  ): Promise<LoanResponseDto> {
    this.logger.log(`Rejecting loan: ${rejectLoanDto.loanId}`);

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
    loan.rejectedBy = adminUser.id;
    loan.rejectionReason = rejectLoanDto.reason;
    loan.updatedAt = new Date();

    const updatedLoan = await this.loanRepository.save(loan);

    this.logger.log(`Loan rejected: ${updatedLoan.loanId}`);

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

    this.logger.log(`Loan disbursed: ${updatedLoan.loanId}`);

    return this.mapToResponse(updatedLoan);
  }

  async remove(id: string): Promise<void> {
    this.logger.log(`Removing loan: ${id}`);

    const loan = await this.loanRepository.findById(id);

    if (!loan) {
      throw new NotFoundException(`Loan with ID ${id} not found`);
    }

    await this.loanRepository.delete(id);
  }

  async getStats(): Promise<LoanStatsDto> {
    this.logger.debug('Getting loan stats');

    return this.loanRepository.getStats();
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
