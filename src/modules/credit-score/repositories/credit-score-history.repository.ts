import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreditScoreHistory } from '../../../entities/credit-score-history.entity';

@Injectable()
export class CreditScoreHistoryRepository {
  constructor(
    @InjectRepository(CreditScoreHistory)
    private readonly repository: Repository<CreditScoreHistory>,
  ) {}

  async create(history: Partial<CreditScoreHistory>): Promise<CreditScoreHistory> {
    const newHistory = this.repository.create(history);
    return this.repository.save(newHistory);
  }

  async findByUserId(userId: string): Promise<CreditScoreHistory[]> {
    return this.repository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 100, // Limit to recent 100 entries
    });
  }

  async findByLoanId(loanId: string): Promise<CreditScoreHistory[]> {
    return this.repository.find({
      where: { loanId },
      order: { createdAt: 'DESC' },
    });
  }

  async findByTransactionId(transactionId: string): Promise<CreditScoreHistory[]> {
    return this.repository.find({
      where: { transactionId },
      order: { createdAt: 'DESC' },
    });
  }

  // Protection methods to prevent modifications for audit integrity
  async update(id: string, data: Partial<CreditScoreHistory>): Promise<never> {
    throw new Error(
      'Updates to credit score history are not allowed for audit integrity. History records are append-only.',
    );
  }

  async delete(id: string): Promise<never> {
    throw new Error(
      'Deletes of credit score history are not allowed for audit integrity. History records are append-only.',
    );
  }

  async remove(entity: CreditScoreHistory): Promise<never> {
    throw new Error(
      'Removal of credit score history is not allowed for audit integrity. History records are append-only.',
    );
  }

  async softDelete(id: string): Promise<never> {
    throw new Error(
      'Soft deletes of credit score history are not allowed for audit integrity. History records are append-only.',
    );
  }
}
