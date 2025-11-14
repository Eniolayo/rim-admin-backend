import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoansService } from './services/loans.service';
import { LoansController } from './controllers/loans.controller';
import { LoanRepository } from './repositories/loan.repository';
import { Loan } from '../../entities/loan.entity';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [TypeOrmModule.forFeature([Loan]), UsersModule],
  controllers: [LoansController],
  providers: [LoansService, LoanRepository],
  exports: [LoansService, LoanRepository],
})
export class LoansModule {}
