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
}
