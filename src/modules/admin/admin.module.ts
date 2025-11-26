import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AdminRole } from '../../entities/admin-role.entity';
import { AdminUser } from '../../entities/admin-user.entity';
import { AdminInvitation } from '../../entities/admin-invitation.entity';
import { AdminActivityLog } from '../../entities/admin-activity-log.entity';
import { SecuritySettings } from '../../entities/security-settings.entity';
import { RolesController } from './controllers/roles.controller';
import { UsersController } from './controllers/users.controller';
import { InvitationsController } from './controllers/invitations.controller';
import { ActivityController } from './controllers/activity.controller';
import { SettingsController } from './controllers/settings.controller';
import { ApiKeysController } from './controllers/api-keys.controller';
import { RolesService } from './services/roles.service';
import { UsersService } from './services/users.service';
import { InvitationsService } from './services/invitations.service';
import { InvitationsCacheService } from './services/invitations-cache.service';
import { ActivityService } from './services/activity.service';
import { SettingsService } from './services/settings.service';
import { ActivityQueueService } from './services/activity-queue.service';
import { AdminRoleRepository } from './repositories/role.repository';
import { AdminMgmtUserRepository } from './repositories/user.repository';
import { InvitationRepository } from './repositories/invitation.repository';
import { AdminActivityLogRepository } from './repositories/activity.repository';
import { SecuritySettingsRepository } from './repositories/settings.repository';
import { ActivityLogInterceptor } from './interceptors/activity-log.interceptor';
import { ActivityLogProcessor } from './processors/activity-log.processor';
import { AuthModule } from '../auth/auth.module';
import { ApiKeyModule } from '../auth/api-key.module';
import { EmailModule } from '../email/email.module';
import { RedisConfig } from '../../config/redis.config';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AdminRole,
      AdminUser,
      AdminInvitation,
      AdminActivityLog,
      SecuritySettings,
    ]),
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
      name: 'activity-logs',
    }),
    AuthModule,
    ApiKeyModule,
    EmailModule,
  ],
  controllers: [
    RolesController,
    UsersController,
    InvitationsController,
    ActivityController,
    SettingsController,
    ApiKeysController,
  ],
  providers: [
    RolesService,
    UsersService,
    InvitationsService,
    InvitationsCacheService,
    ActivityService,
    SettingsService,
    ActivityQueueService,
    AdminRoleRepository,
    AdminMgmtUserRepository,
    InvitationRepository,
    AdminActivityLogRepository,
    SecuritySettingsRepository,
    ActivityLogInterceptor,
    ActivityLogProcessor,
  ],
  exports: [
    RolesService,
    UsersService,
    InvitationsService,
    ActivityService,
    SettingsService,
    ActivityQueueService,
    ActivityLogInterceptor,
  ],
})
export class AdminModule {}
