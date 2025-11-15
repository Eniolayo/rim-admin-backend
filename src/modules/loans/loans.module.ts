import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoansService } from './services/loans.service';
import { LoansController } from './controllers/loans.controller';
import { LoanRepository } from './repositories/loan.repository';
import { LoansCacheService } from './services/loans-cache.service';
import { Loan } from '../../entities/loan.entity';
import { UsersModule } from '../users/users.module';
import { User } from '../../entities/user.entity';
import { UserRepository } from '../users/repositories/user.repository';

@Module({
  imports: [TypeOrmModule.forFeature([Loan, User]), UsersModule],
  controllers: [LoansController],
  providers: [LoansService, LoanRepository, LoansCacheService, UserRepository],
  exports: [LoansService, LoanRepository],
})
export class LoansModule {}
