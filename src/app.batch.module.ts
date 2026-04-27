import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { LoggerModule } from './common/logger/logger.module';
import { RedisModule } from './common/redis/redis.module';
import redisConfig from './config/redis.config';
import appConfig from './config/app.config';
import {
  CsdpSubscriber,
  CsdpEligibilityLog,
  CsdpEligibilityOutcome,
  CsdpLoan,
  CsdpRecovery,
  CsdpRecoveryLoanItem,
  CsdpWebhookInboundLog,
  CsdpFeatureFlag,
  CsdpIngestBatch,
  CsdpIngestRow,
  CsdpCdrRefill,
  CsdpCdrSdp,
} from './entities/csdp';
import { CsdpModule } from './modules/csdp/csdp.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      load: [redisConfig, appConfig],
      // No Joi schema here — the hot process (AppModule) validates envs.
    }),
    LoggerModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const redis = configService.get('redis');
        return {
          connection: {
            host: redis?.host ?? configService.get<string>('REDIS_HOST') ?? 'localhost',
            port: redis?.port ?? parseInt(configService.get<string>('REDIS_PORT') ?? '6379', 10),
            password: redis?.password ?? configService.get<string>('REDIS_PASSWORD'),
            username: redis?.username ?? configService.get<string>('REDIS_USERNAME'),
          },
        };
      },
    }),
    PrometheusModule.register({ path: '/metrics' }),
    RedisModule,
    CsdpModule,
    TypeOrmModule.forRootAsync({
      name: 'csdpHot',
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const hotUrl = configService.get<string>('DATABASE_HOT_URL');
        const isLogging = configService.get<string>('NODE_ENV') === 'development';
        const poolMax = parseInt(
          configService.get<string>('CSDP_HOT_POOL_MAX') ?? '20',
          10,
        );
        const idleTimeoutMs = parseInt(
          configService.get<string>('CSDP_DB_IDLE_TIMEOUT_MS') ?? '10000',
          10,
        );
        const base = {
          type: 'postgres' as const,
          name: 'csdpHot',
          entities: [
            CsdpSubscriber,
            CsdpEligibilityLog,
            CsdpEligibilityOutcome,
            CsdpLoan,
            CsdpRecovery,
            CsdpRecoveryLoanItem,
            CsdpWebhookInboundLog,
            CsdpFeatureFlag,
            CsdpIngestBatch,
            CsdpIngestRow,
            CsdpCdrRefill,
            CsdpCdrSdp,
          ],
          synchronize: false,
          logging: isLogging,
          extra: {
            max: poolMax,
            idleTimeoutMillis: idleTimeoutMs,
            statement_cache_size: 0,
          },
        };
        if (hotUrl) {
          return { ...base, url: hotUrl };
        }
        return {
          ...base,
          host: configService.get<string>('DB_HOST') || 'localhost',
          port: parseInt(configService.get<string>('DB_PORT') ?? '5432', 10),
          username: configService.get<string>('DB_USERNAME') || 'postgres',
          password: configService.get<string>('DB_PASSWORD') || 'postgres',
          database: configService.get<string>('DB_NAME') || 'rim_db',
        };
      },
    }),
    TypeOrmModule.forRootAsync({
      name: 'csdpBatch',
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const batchUrl = configService.get<string>('DATABASE_BATCH_URL');
        const isLogging = configService.get<string>('NODE_ENV') === 'development';
        const poolMax = parseInt(
          configService.get<string>('CSDP_BATCH_POOL_MAX') ?? '3',
          10,
        );
        const idleTimeoutMs = parseInt(
          configService.get<string>('CSDP_DB_IDLE_TIMEOUT_MS') ?? '10000',
          10,
        );
        const base = {
          type: 'postgres' as const,
          name: 'csdpBatch',
          entities: [
            CsdpSubscriber,
            CsdpEligibilityLog,
            CsdpEligibilityOutcome,
            CsdpLoan,
            CsdpRecovery,
            CsdpRecoveryLoanItem,
            CsdpWebhookInboundLog,
            CsdpFeatureFlag,
            CsdpIngestBatch,
            CsdpIngestRow,
            CsdpCdrRefill,
            CsdpCdrSdp,
          ],
          synchronize: false,
          logging: isLogging,
          extra: {
            max: poolMax,
            idleTimeoutMillis: idleTimeoutMs,
            statement_cache_size: 0,
          },
        };
        if (batchUrl) {
          return { ...base, url: batchUrl };
        }
        // Fall back to default DB envs so dev works without pgbouncer
        return {
          ...base,
          host: configService.get<string>('DB_HOST') || 'localhost',
          port: parseInt(configService.get<string>('DB_PORT') ?? '5432', 10),
          username: configService.get<string>('DB_USERNAME') || 'postgres',
          password: configService.get<string>('DB_PASSWORD') || 'postgres',
          database: configService.get<string>('DB_NAME') || 'rim_db',
        };
      },
    }),
  ],
  controllers: [],
})
export class AppBatchModule {}
