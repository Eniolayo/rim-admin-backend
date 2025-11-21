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
import { randomBytes, createHash } from 'crypto';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
import jwtConfig from '../../../config/jwt.config';
import { AdminUserRepository } from '../repositories/admin-user.repository';
import { PendingLoginRepository } from '../repositories/pending-login.repository';
import { BackupCodeRepository } from '../repositories/backup-code.repository';
import {
  LoginDto,
  LoginResultDto,
  UserResponseDto,
  AdminProfileResponseDto,
  UpdateAdminProfileDto,
} from '../dto';
import {
  AdminUser,
  AdminUserStatus,
} from '../../../entities/admin-user.entity';
import { formatRoleName } from '../../../common/utils/role.utils';
import { PendingLogin } from '../../../entities/pending-login.entity';
import { BackupCode } from '../../../entities/backup-code.entity';
import { EmailService } from '../../email/email.service';
import { ForgotPasswordRequestDto, VerifyResetTokenResponseDto, ResetPasswordDto } from '../dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly adminUserRepository: AdminUserRepository,
    private readonly pendingLoginRepository: PendingLoginRepository,
    private readonly backupCodeRepository: BackupCodeRepository,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
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
    const roleName = user.role || user.roleEntity?.name || '';
    return {
      id: user.id,
      email: user.email,
      name: user.username,
      role: formatRoleName(roleName),
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

  async requestPasswordReset(
    dto: ForgotPasswordRequestDto,
    ipAddress?: string,
  ): Promise<{ ok: true }> {
    // Always return success to prevent user enumeration
    const user = await this.adminUserRepository.findByEmail(dto.email);
    if (!user || user.status !== AdminUserStatus.ACTIVE) {
      // Log attempt even if user not found (for security monitoring)
      this.logger.warn(
        `Password reset request failed: email=${dto.email}, reason=user_not_found_or_inactive, ip=${ipAddress || 'unknown'}`,
      );
      return { ok: true };
    }

    // Validate 2FA code if 2FA is enabled
    if (user.twoFactorEnabled) {
      if (!user.otpSecret) {
        this.logger.warn(
          `Password reset request failed: email=${dto.email}, reason=no_otp_secret, ip=${ipAddress || 'unknown'}`,
        );
        return { ok: true };
      }
      
      // Validate TOTP code - checkDelta allows window tolerance for clock drift
      // Returns null if invalid, or a delta (time step difference) if valid
      const delta = authenticator.checkDelta(dto.code, user.otpSecret);
      const valid = delta !== null;
      
      if (!valid) {
        // Log failed 2FA attempt
        this.logger.warn(
          `Password reset request failed: email=${dto.email}, reason=invalid_2fa_code, ip=${ipAddress || 'unknown'}`,
        );
        return { ok: true };
      }
    }

    // Generate reset token
    const token = this.generateHash(32);
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const ttlMinutes = 60;
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
    await this.adminUserRepository.setPasswordResetToken(
      user.id,
      tokenHash,
      expiresAt,
    );

    // Send reset email
    try {
      await this.emailService.sendPasswordResetEmail(
        user.email,
        token,
        expiresAt,
      );
      // Log successful request (for audit trail)
      this.logger.log(
        `Password reset request successful: email=${user.email}, adminId=${user.id}, ip=${ipAddress || 'unknown'}`,
      );
    } catch (e) {
      // Do not leak email failures; still return success
      this.logger.error(
        `Failed to send password reset email: ${e?.message ?? e}`,
      );
    }
    return { ok: true };
  }

  async verifyResetToken(token: string): Promise<VerifyResetTokenResponseDto> {
    const hash = createHash('sha256').update(token).digest('hex');
    // Database query by hash is already effectively constant-time
    // since we're using an indexed hash column
    const user = await this.adminUserRepository.findByResetTokenHash(hash);
    if (!user) {
      return { valid: false, message: 'Invalid or expired reset link' };
    }
    if (user.passwordResetTokenUsedAt) {
      return { valid: false, message: 'Reset link already used' };
    }
    if (
      !user.passwordResetTokenExpiresAt ||
      user.passwordResetTokenExpiresAt.getTime() < Date.now()
    ) {
      return { valid: false, message: 'Reset link has expired' };
    }
    return { valid: true };
  }

  async resetPasswordWithToken(
    dto: ResetPasswordDto,
    ipAddress?: string,
  ): Promise<{ ok: true }> {
    const hash = createHash('sha256').update(dto.token).digest('hex');
    // Database query by hash is already effectively constant-time
    // since we're using an indexed hash column
    const user = await this.adminUserRepository.findByResetTokenHash(hash);
    if (!user) {
      throw new BadRequestException('Invalid reset token');
    }
    if (user.passwordResetTokenUsedAt) {
      throw new BadRequestException('Reset token already used');
    }
    if (
      !user.passwordResetTokenExpiresAt ||
      user.passwordResetTokenExpiresAt.getTime() < Date.now()
    ) {
      throw new BadRequestException('Reset token expired');
    }

    // Update password
    user.password = await this.hashPassword(dto.newPassword);
    user.lastPasswordChangedAt = new Date();
    await this.adminUserRepository.save(user);
    await this.adminUserRepository.markPasswordResetUsed(user.id);
    // Invalidate all refresh tokens (force re-login with new password)
    await this.adminUserRepository.updateRefreshToken(user.id, null);

    // Log successful password reset completion (for audit trail)
    this.logger.log(
      `Password reset completed: email=${user.email}, adminId=${user.id}, ip=${ipAddress || 'unknown'}`,
    );

    return { ok: true };
  }

  async getProfile(userId: string): Promise<AdminProfileResponseDto> {
    this.logger.debug(`Getting profile for user: ${userId}`);
    const user = await this.adminUserRepository.findById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const roleName = user.role || user.roleEntity?.name || '';
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      role: formatRoleName(roleName),
      roleId: user.roleId,
      status: user.status,
      lastLogin: user.lastLogin ?? null,
      twoFactorEnabled: user.twoFactorEnabled,
      createdAt: user.createdAt,
      createdBy: user.createdBy ?? null,
    };
  }

  async updateProfile(
    userId: string,
    updateDto: UpdateAdminProfileDto,
  ): Promise<AdminProfileResponseDto> {
    this.logger.log(`Updating profile for user: ${userId}`);

    const user = await this.adminUserRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Validate password change if new password is provided
    if (updateDto.newPassword) {
      if (!updateDto.currentPassword) {
        throw new BadRequestException(
          'Current password is required to change password',
        );
      }

      const isCurrentPasswordValid = await bcrypt.compare(
        updateDto.currentPassword,
        user.password,
      );

      if (!isCurrentPasswordValid) {
        throw new BadRequestException('Current password is incorrect');
      }

      // Hash and update new password
      user.password = await this.hashPassword(updateDto.newPassword);
    }

    // Update username if provided
    if (
      updateDto.username !== undefined &&
      updateDto.username !== user.username
    ) {
      // Check if username is already taken
      const existingUser = await this.adminUserRepository.findByUsername(
        updateDto.username,
      );
      if (existingUser && existingUser.id !== userId) {
        throw new BadRequestException('Username is already taken');
      }
      user.username = updateDto.username;
    }

    // Update email if provided
    if (updateDto.email !== undefined && updateDto.email !== user.email) {
      // Check if email is already taken
      const existingUser = await this.adminUserRepository.findByEmail(
        updateDto.email,
      );
      if (existingUser && existingUser.id !== userId) {
        throw new BadRequestException('Email is already taken');
      }
      user.email = updateDto.email;
    }

    const updatedUser = await this.adminUserRepository.save(user);

    // Return updated profile directly (no need for another DB call)
    const roleName = updatedUser.role || updatedUser.roleEntity?.name || '';
    return {
      id: updatedUser.id,
      username: updatedUser.username,
      email: updatedUser.email,
      role: formatRoleName(roleName),
      roleId: updatedUser.roleId,
      status: updatedUser.status,
      lastLogin: updatedUser.lastLogin ?? null,
      twoFactorEnabled: updatedUser.twoFactorEnabled,
      createdAt: updatedUser.createdAt,
      createdBy: updatedUser.createdBy ?? null,
    };
  }
}
