import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AdminRole } from '../../entities/admin-role.entity'
import { AdminUser } from '../../entities/admin-user.entity'
import { AdminActivityLog } from '../../entities/admin-activity-log.entity'
import { SecuritySettings } from '../../entities/security-settings.entity'
import { RolesController } from './controllers/roles.controller'
import { UsersController } from './controllers/users.controller'
import { ActivityController } from './controllers/activity.controller'
import { SettingsController } from './controllers/settings.controller'
import { RolesService } from './services/roles.service'
import { UsersService } from './services/users.service'
import { ActivityService } from './services/activity.service'
import { SettingsService } from './services/settings.service'
import { AdminRoleRepository } from './repositories/role.repository'
import { AdminMgmtUserRepository } from './repositories/user.repository'
import { AdminActivityLogRepository } from './repositories/activity.repository'
import { SecuritySettingsRepository } from './repositories/settings.repository'

@Module({
  imports: [TypeOrmModule.forFeature([AdminRole, AdminUser, AdminActivityLog, SecuritySettings])],
  controllers: [RolesController, UsersController, ActivityController, SettingsController],
  providers: [
    RolesService,
    UsersService,
    ActivityService,
    SettingsService,
    AdminRoleRepository,
    AdminMgmtUserRepository,
    AdminActivityLogRepository,
    SecuritySettingsRepository,
  ],
  exports: [RolesService, UsersService, ActivityService, SettingsService],
})
export class AdminModule {}

