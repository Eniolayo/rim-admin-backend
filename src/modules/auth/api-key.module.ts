import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RedisModule } from '../../common/redis/redis.module';
import { ApiKey } from '../../entities/api-key.entity';
import { AdminUser } from '../../entities/admin-user.entity';
import { AdminRole } from '../../entities/admin-role.entity';
import { ApiKeyService } from './services/api-key.service';
import { ApiKeyGuard } from './guards/api-key.guard';
import { ApiKeyRateLimitGuard } from './guards/api-key-rate-limit.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([ApiKey, AdminUser, AdminRole]),
    RedisModule,
  ],
  providers: [ApiKeyService, ApiKeyGuard, ApiKeyRateLimitGuard],
  exports: [ApiKeyService, ApiKeyGuard, ApiKeyRateLimitGuard],
})
export class ApiKeyModule {}

