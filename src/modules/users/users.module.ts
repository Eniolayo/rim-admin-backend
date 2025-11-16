import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './services/users.service';
import { UsersController } from './controllers/users.controller';
import { UserRepository } from './repositories/user.repository';
import { UsersCacheService } from './services/users-cache.service';
import { User } from '../../entities/user.entity';
import { CreditScoreModule } from '../credit-score/credit-score.module';

@Module({
  imports: [TypeOrmModule.forFeature([User]), CreditScoreModule],
  controllers: [UsersController],
  providers: [UsersService, UserRepository, UsersCacheService],
  exports: [UsersService, UserRepository],
})
export class UsersModule {}
