import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AdminRole } from '../../entities/admin-role.entity'
import { AdminUser } from '../../entities/admin-user.entity'
import { AdminInvitation } from '../../entities/admin-invitation.entity'
import { AdminActivityLog } from '../../entities/admin-activity-log.entity'
import { SecuritySettings } from '../../entities/security-settings.entity'
import { RolesController } from './controllers/roles.controller'
import { UsersController } from './controllers/users.controller'
import { InvitationsController } from './controllers/invitations.controller'
import { ActivityController } from './controllers/activity.controller'
import { SettingsController } from './controllers/settings.controller'
import { RolesService } from './services/roles.service'
import { UsersService } from './services/users.service'
import { InvitationsService } from './services/invitations.service'
import { InvitationsCacheService } from './services/invitations-cache.service'
import { ActivityService } from './services/activity.service'
import { SettingsService } from './services/settings.service'
import { AdminRoleRepository } from './repositories/role.repository'
import { AdminMgmtUserRepository } from './repositories/user.repository'
import { InvitationRepository } from './repositories/invitation.repository'
import { AdminActivityLogRepository } from './repositories/activity.repository'
import { SecuritySettingsRepository } from './repositories/settings.repository'
import { ActivityLogInterceptor } from './interceptors/activity-log.interceptor'
import { AuthModule } from '../auth/auth.module'

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AdminRole,
      AdminUser,
      AdminInvitation,
      AdminActivityLog,
      SecuritySettings,
    ]),
    AuthModule,
  ],
  controllers: [
    RolesController,
    UsersController,
    InvitationsController,
    ActivityController,
    SettingsController,
  ],
  providers: [
    RolesService,
    UsersService,
    InvitationsService,
    InvitationsCacheService,
    ActivityService,
    SettingsService,
    AdminRoleRepository,
    AdminMgmtUserRepository,
    InvitationRepository,
    AdminActivityLogRepository,
    SecuritySettingsRepository,
    ActivityLogInterceptor,
  ],
  exports: [
    RolesService,
    UsersService,
    InvitationsService,
    ActivityService,
    SettingsService,
  ],
})
export class AdminModule {}

