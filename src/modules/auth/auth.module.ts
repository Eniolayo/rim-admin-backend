import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigType } from '@nestjs/config';
import jwtConfig from '../../config/jwt.config';
import { AuthController } from './controllers/auth.controller';
import { AuthService } from './services/auth.service';
import { AdminUserRepository } from './repositories/admin-user.repository';
import { JwtStrategy } from './strategies/jwt.strategy';
import { AdminUser, AdminRole, PendingLogin, BackupCode } from '../../entities';
import { PendingLoginRepository } from './repositories/pending-login.repository';
import { BackupCodeRepository } from './repositories/backup-code.repository';
import { AdminController } from './controllers/admin.controller';
import { PermissionsGuard } from './guards/permissions.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([AdminUser, AdminRole, PendingLogin, BackupCode]),
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [jwtConfig.KEY],
      useFactory: (config: ConfigType<typeof jwtConfig>) => ({
        secret: config.secret,
        signOptions: {
          expiresIn: config.expiresIn,
        },
      }),
    }),
  ],
  controllers: [AuthController, AdminController],
  providers: [
    AuthService,
    AdminUserRepository,
    PendingLoginRepository,
    BackupCodeRepository,
    JwtStrategy,
    PermissionsGuard,
  ],
  exports: [
    AuthService,
    AdminUserRepository,
    PendingLoginRepository,
    BackupCodeRepository,
    PermissionsGuard,
  ],
})
export class AuthModule {}
