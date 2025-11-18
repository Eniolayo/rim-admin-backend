import {
  Injectable,
  UnauthorizedException,
  Logger,
  NotFoundException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { ConfigType } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
import jwtConfig from '../../../config/jwt.config';
import { AdminUserRepository } from '../repositories/admin-user.repository';
import { PendingLoginRepository } from '../repositories/pending-login.repository';
import { BackupCodeRepository } from '../repositories/backup-code.repository';
import { LoginDto, LoginResultDto, UserResponseDto } from '../dto';
import {
  AdminUser,
  AdminUserStatus,
} from '../../../entities/admin-user.entity';
import { PendingLogin } from '../../../entities/pending-login.entity';
import { BackupCode } from '../../../entities/backup-code.entity';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly adminUserRepository: AdminUserRepository,
    private readonly pendingLoginRepository: PendingLoginRepository,
    private readonly backupCodeRepository: BackupCodeRepository,
    private readonly jwtService: JwtService,
    @Inject(jwtConfig.KEY)
    private readonly jwtConfiguration: ConfigType<typeof jwtConfig>,
  ) {}

  async validateUser(email: string, password: string): Promise<AdminUser> {
    this.logger.debug(`Validating user: ${email}`);

    const user = await this.adminUserRepository.findByEmail(email);

    if (!user) {
      this.logger.warn(`User not found: ${email}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.status !== AdminUserStatus.ACTIVE) {
      this.logger.warn(`Inactive user attempted login: ${email}`);
      throw new UnauthorizedException('Account is not active');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      this.logger.warn(`Invalid password attempt for: ${email}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    this.logger.debug(`User validated successfully: ${email}`);
    return user;
  }

  async login(loginDto: LoginDto): Promise<LoginResultDto> {
    this.logger.log(`Login attempt for: ${loginDto.email}`);

    const user = await this.validateUser(loginDto.email, loginDto.password);

    user.lastLogin = new Date();
    await this.adminUserRepository.save(user);
    await this.cleanupExpiredSessions(user.id);

    if (!user.twoFactorEnabled) {
      const setup = await this.createPendingSession(
        user.id,
        'setup',
        null,
        null,
      );
      return {
        user: this.mapToUserResponse(user),
        status: 'MFA_SETUP_REQUIRED',
        sessionToken: setup.hash,
        expiresAt: setup.expiresAt,
      };
    }

    const mfa = await this.createPendingSession(user.id, 'mfa', null, null);
    return {
      user: this.mapToUserResponse(user),
      status: 'MFA_REQUIRED',
      temporaryHash: mfa.hash,
      expiresAt: mfa.expiresAt,
    };
  }

  async validateUserById(id: string): Promise<AdminUser> {
    const user = await this.adminUserRepository.findById(id);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.status !== AdminUserStatus.ACTIVE) {
      throw new UnauthorizedException('Account is not active');
    }

    return user;
  }

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  private mapToUserResponse(user: AdminUser): UserResponseDto {
    return {
      id: user.id,
      email: user.email,
      name: user.username,
      role: user.role || user.roleEntity?.name || '',
    };
  }

  private generateHash(length = 32): string {
    return randomBytes(length).toString('hex');
  }

  private async createPendingSession(
    adminUserId: string,
    type: 'mfa' | 'setup',
    ip: string | null,
    userAgent: string | null,
  ): Promise<PendingLogin> {
    const existing = await this.pendingLoginRepository.findActiveByUserAndType(
      adminUserId,
      type,
    );
    if (existing) {
      await this.pendingLoginRepository.markUsed(existing.id);
    }
    const ttlMs = type === 'setup' ? 10 * 60 * 1000 : 10 * 60 * 1000;
    const expiresAt = new Date(Date.now() + ttlMs);
    const entity = new PendingLogin();
    entity.adminUserId = adminUserId;
    entity.type = type;
    entity.hash = this.generateHash(32);
    entity.expiresAt = expiresAt;
    entity.attempts = 0;
    entity.used = false;
    entity.ip = ip;
    entity.userAgent = userAgent;
    entity.secret = null;
    return this.pendingLoginRepository.save(entity);
  }

  async cleanupExpiredSessions(userId: string): Promise<void> {
    const now = new Date();
    await this.pendingLoginRepository.deleteExpiredForUser(userId, now);
    await this.pendingLoginRepository.deleteUsedForUser(userId);
  }

  async completeMfaLogin(
    temporaryHash: string,
    code: string,
  ): Promise<{ token: string; refreshToken: string; expiresIn: string }> {
    // Check if session exists at all (even if used)
    const anySession =
      await this.pendingLoginRepository.findByHash(temporaryHash);

    if (!anySession) {
      throw new BadRequestException('Session not found');
    }

    if (anySession.used) {
      throw new BadRequestException('Session already used');
    }

    if (anySession.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Session expired');
    }

    const session =
      await this.pendingLoginRepository.findActiveByHash(temporaryHash);
    if (!session || session.type !== 'mfa') {
      throw new BadRequestException('Invalid session');
    }
    if (session.expiresAt.getTime() < Date.now()) {
      await this.pendingLoginRepository.markUsed(session.id);
      throw new UnauthorizedException('Session expired');
    }
    const user = await this.adminUserRepository.findById(session.adminUserId);
    if (!user || !user.otpSecret || !user.twoFactorEnabled) {
      await this.pendingLoginRepository.markUsed(session.id);
      throw new UnauthorizedException('Invalid account state');
    }
    const valid = authenticator.check(code, user.otpSecret);
    if (!valid) {
      session.attempts += 1;
      await this.pendingLoginRepository.save(session);
      throw new UnauthorizedException('Invalid code');
    }
    await this.pendingLoginRepository.markUsed(session.id);
    return this.generateTokens(user);
  }

  async start2faSetup(sessionToken: string): Promise<{
    otpauthUrl: string;
    manualKey: string;
    qrCodeDataUrl: string;
    backupCodes: string[];
  }> {
    const session =
      await this.pendingLoginRepository.findActiveByHash(sessionToken);
    if (!session || session.type !== 'setup') {
      throw new BadRequestException('Invalid session');
    }
    if (session.expiresAt.getTime() < Date.now()) {
      await this.pendingLoginRepository.markUsed(session.id);
      throw new UnauthorizedException('Session expired');
    }
    const user = await this.adminUserRepository.findById(session.adminUserId);
    if (!user) {
      await this.pendingLoginRepository.markUsed(session.id);
      throw new UnauthorizedException('Invalid account state');
    }
    const secret = authenticator.generateSecret();
    session.secret = secret;
    await this.pendingLoginRepository.save(session);
    const otpauthUrl = authenticator.keyuri(user.email, 'RIM Admin', secret);
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);
    const codes = await this.generateBackupCodes(user.id);
    return { otpauthUrl, manualKey: secret, qrCodeDataUrl, backupCodes: codes };
  }

  async verify2faSetup(
    sessionToken: string,
    code: string,
  ): Promise<{ token: string; refreshToken: string; expiresIn: string }> {
    const session =
      await this.pendingLoginRepository.findActiveByHash(sessionToken);
    if (!session || session.type !== 'setup' || !session.secret) {
      throw new BadRequestException('Invalid session');
    }
    if (session.expiresAt.getTime() < Date.now()) {
      await this.pendingLoginRepository.markUsed(session.id);
      throw new UnauthorizedException('Session expired');
    }
    const valid = authenticator.check(code, session.secret);
    if (!valid) {
      session.attempts += 1;
      await this.pendingLoginRepository.save(session);
      throw new UnauthorizedException('Invalid code');
    }
    const user = await this.adminUserRepository.findById(session.adminUserId);
    if (!user) {
      await this.pendingLoginRepository.markUsed(session.id);
      throw new UnauthorizedException('Invalid account state');
    }
    user.otpSecret = session.secret;
    user.twoFactorEnabled = true;
    await this.adminUserRepository.save(user);
    await this.pendingLoginRepository.markUsed(session.id);
    // User has already provided credentials and verified 2FA, so issue tokens directly
    return this.generateTokens(user);
  }

  private async generateBackupCodes(adminUserId: string): Promise<string[]> {
    const count = 10;
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      codes.push(this.generateHash(8));
    }
    await this.backupCodeRepository.deleteAllForUser(adminUserId);
    const toSave: BackupCode[] = await Promise.all(
      codes.map(async (c) => {
        const bc = new BackupCode();
        bc.adminUserId = adminUserId;
        bc.codeHash = await bcrypt.hash(c, 10);
        bc.used = false;
        return bc;
      }),
    );
    await this.backupCodeRepository.saveAll(toSave);
    return codes;
  }

  async regenerateBackupCodes(adminUserId: string): Promise<string[]> {
    return this.generateBackupCodes(adminUserId);
  }

  async consumeBackupCode(
    temporaryHash: string,
    code: string,
  ): Promise<{ token: string; refreshToken: string; expiresIn: string }> {
    const session =
      await this.pendingLoginRepository.findActiveByHash(temporaryHash);
    if (!session || session.type !== 'mfa') {
      throw new BadRequestException('Invalid session');
    }
    if (session.expiresAt.getTime() < Date.now()) {
      await this.pendingLoginRepository.markUsed(session.id);
      throw new UnauthorizedException('Session expired');
    }
    const user = await this.adminUserRepository.findById(session.adminUserId);
    if (!user || !user.twoFactorEnabled) {
      await this.pendingLoginRepository.markUsed(session.id);
      throw new UnauthorizedException('Invalid account state');
    }
    const codes = await this.backupCodeRepository.findActiveByUser(user.id);
    let matched: BackupCode | null = null;
    for (const bc of codes) {
      const ok = await bcrypt.compare(code, bc.codeHash);
      if (ok) {
        matched = bc;
        break;
      }
    }
    if (!matched) {
      session.attempts += 1;
      await this.pendingLoginRepository.save(session);
      throw new UnauthorizedException('Invalid code');
    }
    await this.backupCodeRepository.markUsed(matched.id);
    await this.pendingLoginRepository.markUsed(session.id);
    return this.generateTokens(user);
  }

  private async generateTokens(
    user: AdminUser,
  ): Promise<{ token: string; refreshToken: string; expiresIn: string }> {
    const payload = {
      sub: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
    };

    const [token, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.jwtConfiguration.secret,
        expiresIn: this.jwtConfiguration.expiresIn,
      }),
      this.jwtService.signAsync(payload, {
        secret: this.jwtConfiguration.refreshSecret,
        expiresIn: this.jwtConfiguration.refreshExpiresIn,
      }),
    ]);

    // Store refresh token in database
    await this.adminUserRepository.updateRefreshToken(user.id, refreshToken);

    return {
      token,
      refreshToken,
      expiresIn: this.jwtConfiguration.expiresIn,
    };
  }

  async refreshToken(
    refreshToken: string,
  ): Promise<{ token: string; refreshToken: string; expiresIn: string }> {
    try {
      const payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.jwtConfiguration.refreshSecret,
      });

      const user = await this.adminUserRepository.findById(payload.sub);
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      if (user.status !== AdminUserStatus.ACTIVE) {
        throw new UnauthorizedException('Account is not active');
      }

      // Verify the refresh token matches the one stored in the database
      if (user.refreshToken !== refreshToken) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Generate new tokens
      return this.generateTokens(user);
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid refresh token');
    }
  }
}
