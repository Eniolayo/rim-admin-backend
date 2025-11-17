import { Injectable, BadRequestException } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { LoansService } from '../../loans/services/loans.service';
import { UsersService } from '../../users/services/users.service';
import { TransactionsService } from '../../transactions/services/transactions.service';
import { DashboardStatsDto } from '../dto/dashboard-stats.dto';

@Injectable()
export class DashboardService {
  constructor(
    private readonly loansService: LoansService,
    private readonly usersService: UsersService,
    private readonly transactionsService: TransactionsService,
    private readonly logger: Logger,
  ) {}

  async getStats(): Promise<DashboardStatsDto> {
    this.logger.debug('Getting dashboard stats');

    try {
      // Fetch all stats in parallel for better performance
      const [loanStats, userStats, transactionStats] = await Promise.all([
        this.loansService.getStats(),
        this.usersService.getStats(),
        this.transactionsService.stats(),
      ]);

      return {
        loanStats,
        userStats,
        transactionStats,
      };
    } catch (error) {
      this.logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
        'Error getting dashboard stats',
      );
      throw new BadRequestException('Error retrieving dashboard statistics');
    }
  }
}

