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
import { EmailModule } from '../email/email.module';
import { ApiKeyModule } from './api-key.module';
import { OAuth2Controller } from './controllers/oauth2.controller';
import { OAuth2Service } from './services/oauth2.service';
import { OAuth2Guard } from './guards/oauth2.guard';
import { ApiKey } from '../../entities/api-key.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AdminUser,
      AdminRole,
      PendingLogin,
      BackupCode,
      ApiKey,
    ]),
    PassportModule,
    EmailModule,
    ApiKeyModule,
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
  controllers: [AuthController, AdminController, OAuth2Controller],
  providers: [
    AuthService,
    AdminUserRepository,
    PendingLoginRepository,
    BackupCodeRepository,
    JwtStrategy,
    PermissionsGuard,
    OAuth2Service,
    OAuth2Guard,
  ],
  exports: [
    AuthService,
    AdminUserRepository,
    PendingLoginRepository,
    BackupCodeRepository,
    PermissionsGuard,
    OAuth2Service,
    OAuth2Guard,
    JwtModule,
  ],
})
export class AuthModule {}
