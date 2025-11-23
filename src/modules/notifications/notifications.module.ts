import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Notification } from '../../entities/notification.entity';
import { AdminUser } from '../../entities/admin-user.entity';
import { NotificationController } from './controllers/notification.controller';
import { NotificationService } from './services/notification.service';
import { NotificationConfigService } from './services/notification-config.service';
import { NotificationQueueService } from './services/notification-queue.service';
import { NotificationRepository } from './repositories/notification.repository';
import { NotificationProcessor } from './processors/notification.processor';
import { NotificationGateway } from './gateways/notification.gateway';
import { AuthModule } from '../auth/auth.module';
import { RedisConfig } from '../../config/redis.config';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification, AdminUser]),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const redisConfig = configService.get<RedisConfig>('redis');
        if (!redisConfig) {
          throw new Error('Redis configuration is missing');
        }

        // If URL is provided, use it directly (production)
        if (redisConfig.url) {
          return {
            connection: {
              url: redisConfig.url,
            },
          };
        }

        // Otherwise, use individual config (development)
        return {
          connection: {
            host: redisConfig.host || 'localhost',
            port: redisConfig.port || 6379,
            password: redisConfig.password,
            username: redisConfig.username,
          },
        };
      },
    }),
    BullModule.registerQueue({
      name: 'notifications',
    }),
    AuthModule,
  ],
  controllers: [NotificationController],
  providers: [
    NotificationService,
    NotificationConfigService,
    NotificationQueueService,
    NotificationRepository,
    NotificationProcessor,
    NotificationGateway,
  ],
  exports: [NotificationService],
})
export class NotificationsModule {}

