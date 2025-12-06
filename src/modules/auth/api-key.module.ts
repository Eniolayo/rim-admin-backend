import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { RedisModule } from '../../common/redis/redis.module';
import { ApiKey } from '../../entities/api-key.entity';
import { AdminUser } from '../../entities/admin-user.entity';
import { AdminRole } from '../../entities/admin-role.entity';
import { ApiKeyService } from './services/api-key.service';
import { ApiKeyGuard } from './guards/api-key.guard';
import { ApiKeyRateLimitGuard } from './guards/api-key-rate-limit.guard';
import { JwtOrApiKeyGuard } from './guards/jwt-or-api-key.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([ApiKey, AdminUser, AdminRole]),
    RedisModule,
    PassportModule,
  ],
  providers: [
    ApiKeyService,
    ApiKeyGuard,
    ApiKeyRateLimitGuard,
    JwtOrApiKeyGuard,
  ],
  exports: [ApiKeyService, ApiKeyGuard, ApiKeyRateLimitGuard, JwtOrApiKeyGuard],
})
export class ApiKeyModule {}
