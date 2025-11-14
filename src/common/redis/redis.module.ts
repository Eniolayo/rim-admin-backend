import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { RedisConfig } from '../../config/redis.config';
import { RedisService } from './redis.service';
import { REDIS_CLIENT } from './redis.constants';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService): Redis => {
        const redisConfig = configService.get<RedisConfig>('redis');

        if (!redisConfig) {
          throw new Error('Redis configuration is missing');
        }

        // If URL is provided, use it directly (production)
        if (redisConfig.url) {
          return new Redis(redisConfig.url, {
            maxRetriesPerRequest: 3,
            enableReadyCheck: true,
            lazyConnect: true,
          });
        }

        // Otherwise, use individual config (development)
        return new Redis({
          host: redisConfig.host || 'localhost',
          port: redisConfig.port || 6379,
          password: redisConfig.password,
          username: redisConfig.username,
          maxRetriesPerRequest: 3,
          enableReadyCheck: true,
          lazyConnect: true,
        });
      },
    },
    RedisService,
  ],
  exports: [REDIS_CLIENT, RedisService],
})
export class RedisModule {}
