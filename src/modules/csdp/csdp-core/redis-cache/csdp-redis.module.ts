import { Global, Module, OnModuleDestroy, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis, { RedisOptions } from 'ioredis';
import { RedisConfig } from '../../../../config/redis.config';
import { CSDP_REDIS_CACHE, CSDP_REDIS_FLAGS, CSDP_REDIS_KEY_PREFIX } from './csdp-redis.constants';
import { CsdpCacheService } from './csdp-cache.service';

function buildRedisClient(configService: ConfigService, db: number): Redis {
  const redisConfig = configService.get<RedisConfig>('redis');

  if (!redisConfig) {
    throw new Error('Redis configuration is missing for CSDP Redis module');
  }

  const sharedOptions: RedisOptions = {
    db,
    keyPrefix: CSDP_REDIS_KEY_PREFIX,
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: true,
  };

  if (redisConfig.url) {
    return new Redis(redisConfig.url, sharedOptions);
  }

  return new Redis({
    host: redisConfig.host || 'localhost',
    port: redisConfig.port || 6379,
    password: redisConfig.password,
    username: redisConfig.username,
    ...sharedOptions,
  });
}

@Global()
@Module({
  providers: [
    {
      provide: CSDP_REDIS_CACHE,
      inject: [ConfigService],
      useFactory: (configService: ConfigService): Redis =>
        buildRedisClient(configService, 1),
    },
    {
      provide: CSDP_REDIS_FLAGS,
      inject: [ConfigService],
      useFactory: (configService: ConfigService): Redis =>
        buildRedisClient(configService, 2),
    },
    CsdpCacheService,
  ],
  exports: [CSDP_REDIS_CACHE, CSDP_REDIS_FLAGS, CsdpCacheService],
})
export class CsdpRedisModule implements OnModuleDestroy {
  constructor(
    @Inject(CSDP_REDIS_FLAGS) private readonly flagsClient: Redis,
  ) {}

  async onModuleDestroy(): Promise<void> {
    if (this.flagsClient.status === 'ready') {
      await this.flagsClient.quit();
    }
    // CsdpCacheService handles CSDP_REDIS_CACHE quit in its own OnModuleDestroy
  }
}
