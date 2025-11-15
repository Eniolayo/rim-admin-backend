import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoansService } from './services/loans.service';
import { LoansController } from './controllers/loans.controller';
import { LoanRepository } from './repositories/loan.repository';
import { LoansCacheService } from './services/loans-cache.service';
import { Loan } from '../../entities/loan.entity';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [TypeOrmModule.forFeature([Loan]), UsersModule],
  controllers: [LoansController],
  providers: [LoansService, LoanRepository, LoansCacheService],
  exports: [LoansService, LoanRepository],
})
export class LoansModule {}
