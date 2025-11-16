import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Loan, LoanStatus, Network } from '../../../entities/loan.entity';

@Injectable()
export class LoanRepository {
  constructor(
    @InjectRepository(Loan)
    private readonly repository: Repository<Loan>,
  ) {}

  async findById(id: string): Promise<Loan | null> {
    return this.repository.findOne({
      where: { id },
      relations: ['user', 'approver', 'rejector'],
    });
  }

  async findByLoanId(loanId: string): Promise<Loan | null> {
    return this.repository.findOne({
      where: { loanId },
      relations: ['user', 'approver', 'rejector'],
    });
  }

  async findByUserId(userId: string): Promise<Loan[]> {
    return this.repository.find({
      where: { userId },
      relations: ['user', 'approver', 'rejector'],
      order: { createdAt: 'DESC' },
    });
  }

  async findAll(): Promise<Loan[]> {
    return this.repository.find({
      relations: ['user', 'approver', 'rejector'],
      order: { createdAt: 'DESC' },
    });
  }

  async findWithFilters(filters: {
    status?: LoanStatus;
    network?: Network;
    search?: string;
    dateRange?: { from: Date; to: Date };
    amountRange?: { min: number; max: number };
    page?: number;
    limit?: number;
  }): Promise<[Loan[], number]> {
    const queryBuilder = this.repository.createQueryBuilder('loan');

    if (filters.status) {
      queryBuilder.andWhere('loan.status = :status', {
        status: filters.status,
      });
    }

    if (filters.network) {
      queryBuilder.andWhere('loan.network = :network', {
        network: filters.network,
      });
    }

    if (filters.search) {
      queryBuilder.andWhere(
        '(loan.loanId LIKE :search OR loan.userPhone LIKE :search OR loan.userEmail LIKE :search)',
        { search: `%${filters.search}%` },
      );
    }

    if (filters.dateRange) {
      queryBuilder.andWhere('loan.createdAt BETWEEN :from AND :to', {
        from: filters.dateRange.from,
        to: filters.dateRange.to,
      });
    }

    if (filters.amountRange) {
      queryBuilder.andWhere('loan.amount BETWEEN :min AND :max', {
        min: filters.amountRange.min,
        max: filters.amountRange.max,
      });
    }

    // Apply pagination
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 10;
    const skip = (page - 1) * limit;

    queryBuilder.skip(skip).take(limit);

    return queryBuilder
      .leftJoinAndSelect('loan.user', 'user')
      .leftJoinAndSelect('loan.approver', 'approver')
      .leftJoinAndSelect('loan.rejector', 'rejector')
      .orderBy('loan.createdAt', 'DESC')
      .getManyAndCount();
  }

  async findAllForExport(filters: {
    status?: LoanStatus;
    network?: Network;
    search?: string;
    dateRange?: { from: Date; to: Date };
    amountRange?: { min: number; max: number };
  }): Promise<Loan[]> {
    const queryBuilder = this.repository.createQueryBuilder('loan');

    if (filters.status) {
      queryBuilder.andWhere('loan.status = :status', {
        status: filters.status,
      });
    }

    if (filters.network) {
      queryBuilder.andWhere('loan.network = :network', {
        network: filters.network,
      });
    }

    if (filters.search) {
      queryBuilder.andWhere(
        '(loan.loanId LIKE :search OR loan.userPhone LIKE :search OR loan.userEmail LIKE :search)',
        { search: `%${filters.search}%` },
      );
    }

    if (filters.dateRange) {
      queryBuilder.andWhere('loan.createdAt BETWEEN :from AND :to', {
        from: filters.dateRange.from,
        to: filters.dateRange.to,
      });
    }

    if (filters.amountRange) {
      queryBuilder.andWhere('loan.amount BETWEEN :min AND :max', {
        min: filters.amountRange.min,
        max: filters.amountRange.max,
      });
    }

    return queryBuilder
      .leftJoinAndSelect('loan.user', 'user')
      .leftJoinAndSelect('loan.approver', 'approver')
      .leftJoinAndSelect('loan.rejector', 'rejector')
      .orderBy('loan.createdAt', 'DESC')
      .getMany();
  }

  async getPerformanceReportData(
    startDate: Date,
    endDate: Date,
  ): Promise<Loan[]> {
    // Set endDate to end of day to include all loans on that day
    const endOfDay = new Date(endDate);
    endOfDay.setHours(23, 59, 59, 999);

    return this.repository
      .createQueryBuilder('loan')
      .where('loan.createdAt >= :startDate', { startDate })
      .andWhere('loan.createdAt <= :endDate', { endDate: endOfDay })
      .orderBy('loan.createdAt', 'DESC')
      .getMany();
  }

  async save(loan: Loan): Promise<Loan> {
    return this.repository.save(loan);
  }

  async update(
    id: string,
    updateData: Partial<Omit<Loan, 'user' | 'approver' | 'rejector'>>,
  ): Promise<void> {
    // Extract metadata if present and handle separately
    const { metadata, ...rest } = updateData;
    if (Object.keys(rest).length > 0) {
      // Type assertion needed for partial updates with complex types
      await this.repository.update(id, rest as any);
    }
    if (metadata !== undefined) {
      // Type assertion needed for JSONB fields in TypeORM query builder
      await this.repository
        .createQueryBuilder()
        .update(Loan)
        .set({ metadata: metadata as Record<string, unknown> | null } as any)
        .where('id = :id', { id })
        .execute();
    }
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }

  async generateLoanId(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.repository
      .createQueryBuilder('loan')
      .where('loan.loanId LIKE :pattern', { pattern: `LOAN-${year}-%` })
      .getCount();
    const sequence = String(count + 1).padStart(3, '0');
    return `LOAN-${year}-${sequence}`;
  }

  async getStats(): Promise<{
    totalLoans: number;
    totalLoanAmount: number;
    pendingLoans: number;
    approvedLoans: number;
    outstandingLoans: number;
    defaultedLoans: number;
    totalOutstanding: number;
    totalRepaid: number;
    defaultRate: number;
    repaymentRate: number;
    averageLoanAmount: number;
    todayLoans: number;
    todayAmount: number;
  }> {
    const loans = await this.repository.find();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayLoans = loans.filter(
      (loan) => loan.createdAt >= today && loan.createdAt < tomorrow,
    );

    const completedLoans = loans.filter(
      (loan) => loan.status === LoanStatus.COMPLETED,
    );
    const defaultedLoans = loans.filter(
      (loan) => loan.status === LoanStatus.DEFAULTED,
    );
    const outstandingLoans = loans.filter((loan) =>
      [LoanStatus.DISBURSED, LoanStatus.REPAYING].includes(loan.status),
    );

    const totalRepaid = loans.reduce(
      (sum, loan) => sum + Number(loan.amountPaid),
      0,
    );
    const totalOutstanding = loans.reduce(
      (sum, loan) => sum + Number(loan.outstandingAmount),
      0,
    );
    const totalDisbursed = loans
      .filter((loan) =>
        [
          LoanStatus.DISBURSED,
          LoanStatus.REPAYING,
          LoanStatus.COMPLETED,
          LoanStatus.DEFAULTED,
        ].includes(loan.status),
      )
      .reduce((sum, loan) => sum + Number(loan.disbursedAmount), 0);

    const defaultRate =
      completedLoans.length + defaultedLoans.length > 0
        ? (defaultedLoans.length /
            (completedLoans.length + defaultedLoans.length)) *
          100
        : 0;

    const repaymentRate =
      totalDisbursed > 0 ? (totalRepaid / totalDisbursed) * 100 : 0;

    return {
      totalLoans: loans.length,
      totalLoanAmount: loans.reduce(
        (sum, loan) => sum + Number(loan.amount),
        0,
      ),
      pendingLoans: loans.filter((loan) => loan.status === LoanStatus.PENDING)
        .length,
      approvedLoans: loans.filter((loan) => loan.status === LoanStatus.APPROVED)
        .length,
      outstandingLoans: outstandingLoans.length,
      defaultedLoans: defaultedLoans.length,
      totalOutstanding,
      totalRepaid,
      defaultRate,
      repaymentRate,
      averageLoanAmount:
        loans.length > 0
          ? loans.reduce((sum, loan) => sum + Number(loan.amount), 0) /
            loans.length
          : 0,
      todayLoans: todayLoans.length,
      todayAmount: todayLoans.reduce(
        (sum, loan) => sum + Number(loan.amount),
        0,
      ),
    };
  }
}
