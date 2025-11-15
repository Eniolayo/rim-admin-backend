import {
  Injectable,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { InvitationRepository } from '../repositories/invitation.repository';
import { AdminRoleRepository } from '../repositories/role.repository';
import { AdminUserRepository } from '../../auth/repositories/admin-user.repository';
import {
  AdminInvitation,
  AdminInvitationRole,
  AdminInvitationStatus,
} from '../../../entities/admin-invitation.entity';
import { AdminUser, AdminUserStatus } from '../../../entities/admin-user.entity';
import {
  InviteAdminDto,
  AdminInvitationResponseDto,
  VerifyInviteResponseDto,
  SetupAdminAccountDto,
  SetupAdminAccountResponseDto,
} from '../dto/invitation.dto';
import { AdminUserResponseDto } from '../dto/admin-user.dto';
import { InvitationsCacheService } from './invitations-cache.service';

@Injectable()
export class InvitationsService {
  constructor(
    private readonly invitationRepository: InvitationRepository,
    private readonly roleRepository: AdminRoleRepository,
    private readonly adminUserRepository: AdminUserRepository,
    private readonly cacheService: InvitationsCacheService,
    private readonly logger: Logger,
  ) {}

  // Convert enum role to role name
  private enumToRoleName(role: AdminInvitationRole): string {
    switch (role) {
      case AdminInvitationRole.SUPER_ADMIN:
        return 'super_Admin';
      case AdminInvitationRole.ADMIN:
        return 'Admin';
      case AdminInvitationRole.MODERATOR:
        return 'moderator';
      default:
        throw new BadRequestException(`Invalid role: ${role}`);
    }
  }

  private toInvitationDto(
    invitation: AdminInvitation,
  ): AdminInvitationResponseDto {
    return {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      inviteToken: invitation.inviteToken,
      invitedBy: invitation.invitedBy,
      invitedByName: invitation.invitedByName,
      createdAt: invitation.createdAt,
      expiresAt: invitation.expiresAt,
      acceptedAt: invitation.acceptedAt ?? null,
      status: invitation.status,
    };
  }

  private toAdminUserDto(user: AdminUser): AdminUserResponseDto {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role || user.roleEntity?.name || '',
      roleId: user.roleId,
      status: user.status,
      lastLogin: user.lastLogin ?? null,
      twoFactorEnabled: user.twoFactorEnabled,
      createdAt: user.createdAt,
      createdBy: user.createdBy ?? null,
    };
  }

  private generateToken(): string {
    return randomBytes(32).toString('hex');
  }

  async inviteAdmin(
    dto: InviteAdminDto,
    invitedBy: AdminUser,
  ): Promise<AdminInvitationResponseDto> {
    try {
      this.logger.log(
        `Inviting admin: email=${dto.email}, role=${dto.role}, invitedBy=${invitedBy.id}`,
      );

      // Check if email already has a pending invitation
      const existingInvitation =
        await this.invitationRepository.findByEmail(
          dto.email,
          AdminInvitationStatus.PENDING,
        );

      if (existingInvitation) {
        this.logger.warn(
          `Duplicate invitation attempt for email: ${dto.email}`,
        );
        throw new BadRequestException(
          'This email has already been invited',
        );
      }

      // Check if email is already an admin user
      const existingUser = await this.adminUserRepository.findByEmail(
        dto.email,
      );
      if (existingUser) {
        this.logger.warn(`Email already exists as admin user: ${dto.email}`);
        throw new BadRequestException(
          'This email is already registered as an admin',
        );
      }

      // Convert enum role to role name
      const backendRoleName = this.enumToRoleName(dto.role);

      // Find role by name
      const role = await this.roleRepository.findByName(backendRoleName);
      if (!role) {
        this.logger.error(`Role not found: ${backendRoleName}`);
        throw new NotFoundException(
          `Role '${backendRoleName}' not found in system`,
        );
      }

      // Generate secure token
      const token = this.generateToken();

      // Create invitation with 7-day expiration
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const invitation = new AdminInvitation();
      invitation.email = dto.email;
      invitation.role = dto.role;
      invitation.inviteToken = token;
      invitation.invitedBy = invitedBy.id;
      invitation.invitedByName = invitedBy.username;
      invitation.expiresAt = expiresAt;
      invitation.status = AdminInvitationStatus.PENDING;

      const saved = await this.invitationRepository.create(invitation);

      // Invalidate list cache after creating new invitation
      await this.cacheService.invalidateInvitationsList();

      this.logger.log(`Successfully created invitation: ${saved.id}`);
      return this.toInvitationDto(saved);
    } catch (error) {
      // Re-throw known exceptions
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      this.logger.error(
        `Error inviting admin: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('Failed to create invitation');
    }
  }

  async getInvitations(): Promise<AdminInvitationResponseDto[]> {
    try {
      this.logger.log('Retrieving all invitations');

      // Check cache first
      const cached = await this.cacheService.getInvitationsList();
      if (cached) {
        return cached;
      }

      // Cache miss - fetch from database
      const invitations = await this.invitationRepository.findAll();
      const result = invitations.map((inv) => this.toInvitationDto(inv));

      // Populate cache
      await this.cacheService.setInvitationsList(result);

      this.logger.debug(`Retrieved ${invitations.length} invitations`);
      return result;
    } catch (error) {
      this.logger.error(
        `Error retrieving invitations: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('Failed to retrieve invitations');
    }
  }

  async verifyInviteToken(token: string): Promise<VerifyInviteResponseDto> {
    try {
      this.logger.log('Verifying invitation token');

      // Check cache first
      const cached = await this.cacheService.getVerifyToken(token);
      if (cached) {
        return cached;
      }

      // Cache miss - verify from database
      const invitation = await this.invitationRepository.findByToken(token);

      if (!invitation) {
        this.logger.warn('Invalid invitation token');
        const result = {
          valid: false,
          message: 'Invalid or expired invitation link',
        };
        // Cache invalid token result
        await this.cacheService.setVerifyToken(token, result);
        return result;
      }

      // Check if already accepted
      if (invitation.status === AdminInvitationStatus.ACCEPTED) {
        this.logger.warn(`Invitation already accepted: ${invitation.id}`);
        const result = {
          valid: false,
          message: 'This invitation has already been used',
        };
        // Cache already accepted result
        await this.cacheService.setVerifyToken(token, result);
        return result;
      }

      // Check if expired
      const now = new Date();
      if (
        invitation.status === AdminInvitationStatus.EXPIRED ||
        invitation.expiresAt < now
      ) {
        // Mark as expired if not already
        if (invitation.status !== AdminInvitationStatus.EXPIRED) {
          await this.invitationRepository.update(invitation.id, {
            status: AdminInvitationStatus.EXPIRED,
          });
        }
        this.logger.warn(`Invitation expired: ${invitation.id}`);
        const result = {
          valid: false,
          message: 'This invitation has expired',
        };
        // Cache expired result
        await this.cacheService.setVerifyToken(token, result);
        return result;
      }

      this.logger.log(`Token verified successfully: ${invitation.id}`);
      const result = {
        valid: true,
        invitation: this.toInvitationDto(invitation),
      };

      // Cache the result
      await this.cacheService.setVerifyToken(token, result);

      return result;
    } catch (error) {
      this.logger.error(
        `Error verifying token: ${error.message}`,
        error.stack,
      );
      const errorResult = {
        valid: false,
        message: 'An error occurred while verifying the invitation',
      };

      // Cache error result as well to avoid repeated DB queries for invalid tokens
      await this.cacheService.setVerifyToken(token, errorResult);

      return errorResult;
    }
  }

  async setupAdminAccount(
    dto: SetupAdminAccountDto,
  ): Promise<SetupAdminAccountResponseDto> {
    try {
      this.logger.log('Setting up admin account');

      // Verify token
      const invitation = await this.invitationRepository.findByToken(
        dto.inviteToken,
      );

      if (!invitation) {
        this.logger.warn('Invalid invitation token for setup');
        throw new BadRequestException('Invalid invitation token');
      }

      // Check if already accepted
      if (invitation.status === AdminInvitationStatus.ACCEPTED) {
        this.logger.warn(`Invitation already accepted: ${invitation.id}`);
        throw new BadRequestException('This invitation has already been used');
      }

      // Check if expired
      const now = new Date();
      if (
        invitation.status === AdminInvitationStatus.EXPIRED ||
        invitation.expiresAt < now
      ) {
        if (invitation.status !== AdminInvitationStatus.EXPIRED) {
          await this.invitationRepository.update(invitation.id, {
            status: AdminInvitationStatus.EXPIRED,
          });
        }
        this.logger.warn(`Invitation expired: ${invitation.id}`);
        throw new BadRequestException('This invitation has expired');
      }

      // Check if email already exists
      const existingUser = await this.adminUserRepository.findByEmail(
        invitation.email,
      );
      if (existingUser) {
        this.logger.warn(`Email already exists: ${invitation.email}`);
        throw new BadRequestException(
          'An account with this email already exists',
        );
      }

      // Convert enum role to role name
      const backendRoleName = this.enumToRoleName(invitation.role);

      // Find role
      const role = await this.roleRepository.findByName(backendRoleName);
      if (!role) {
        this.logger.error(`Role not found: ${backendRoleName}`);
        throw new InternalServerErrorException(
          `Role '${backendRoleName}' not found in system`,
        );
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(dto.password, 10);

      // Generate username from name
      const username = dto.name.toLowerCase().replace(/\s+/g, '.');

      // Check if username already exists
      const existingUsername = await this.adminUserRepository.findByUsername(
        username,
      );
      let finalUsername = username;
      if (existingUsername) {
        // Append a number if username exists
        let counter = 1;
        while (
          await this.adminUserRepository.findByUsername(
            `${username}.${counter}`,
          )
        ) {
          counter++;
        }
        finalUsername = `${username}.${counter}`;
      }

      // Create admin user
      const newAdmin = new AdminUser();
      newAdmin.username = finalUsername;
      newAdmin.email = invitation.email;
      newAdmin.password = hashedPassword;
      newAdmin.role = backendRoleName;
      newAdmin.roleId = role.id;
      newAdmin.status = AdminUserStatus.ACTIVE;
      newAdmin.twoFactorEnabled = false; // CRITICAL: Force 2FA setup on first login
      newAdmin.otpSecret = null;
      newAdmin.lastLogin = null;
      newAdmin.createdBy = invitation.invitedBy;

      const savedUser = await this.adminUserRepository.save(newAdmin);

      // Mark invitation as accepted
      await this.invitationRepository.update(invitation.id, {
        status: AdminInvitationStatus.ACCEPTED,
        acceptedAt: now,
      });

      // Invalidate caches after accepting invitation
      await this.cacheService.invalidateInvitationsList();
      await this.cacheService.invalidateVerifyToken(dto.inviteToken);

      this.logger.log(
        `Successfully created admin account: ${savedUser.id} for ${savedUser.email}`,
      );

      return this.toAdminUserDto(savedUser);
    } catch (error) {
      // Re-throw known exceptions
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }

      this.logger.error(
        `Error setting up admin account: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('Failed to set up admin account');
    }
  }

  async resendInvitation(
    id: string,
    invitedBy: AdminUser,
  ): Promise<AdminInvitationResponseDto> {
    try {
      this.logger.log(`Resending invitation: ${id}`);

      const invitation = await this.invitationRepository.findById(id);

      if (!invitation) {
        this.logger.warn(`Invitation not found: ${id}`);
        throw new NotFoundException(`Invitation with id ${id} not found`);
      }

      if (invitation.status !== AdminInvitationStatus.PENDING) {
        this.logger.warn(
          `Cannot resend non-pending invitation: ${id}, status=${invitation.status}`,
        );
        throw new BadRequestException(
          'Can only resend pending invitations',
        );
      }

      // Check if expired
      const now = new Date();
      if (invitation.expiresAt < now) {
        this.logger.warn(`Invitation expired: ${id}`);
        throw new BadRequestException('This invitation has expired');
      }

      // Generate new token and extend expiration
      const newToken = this.generateToken();
      const newExpiresAt = new Date();
      newExpiresAt.setDate(newExpiresAt.getDate() + 7);

      const updated = await this.invitationRepository.update(invitation.id, {
        inviteToken: newToken,
        expiresAt: newExpiresAt,
        invitedBy: invitedBy.id,
        invitedByName: invitedBy.username,
      });

      // Invalidate caches after resending invitation
      await this.cacheService.invalidateInvitationsList();
      // Invalidate old token cache if it exists
      await this.cacheService.invalidateVerifyToken(invitation.inviteToken);

      this.logger.log(`Successfully resent invitation: ${id}`);
      return this.toInvitationDto(updated);
    } catch (error) {
      // Re-throw known exceptions
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      this.logger.error(
        `Error resending invitation: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('Failed to resend invitation');
    }
  }

  async cancelInvitation(id: string): Promise<void> {
    try {
      this.logger.log(`Cancelling invitation: ${id}`);

      const invitation = await this.invitationRepository.findById(id);

      if (!invitation) {
        this.logger.warn(`Invitation not found: ${id}`);
        throw new NotFoundException(`Invitation with id ${id} not found`);
      }

      await this.invitationRepository.delete(id);

      // Invalidate list cache after cancelling invitation
      await this.cacheService.invalidateInvitationsList();

      this.logger.log(`Successfully cancelled invitation: ${id}`);
    } catch (error) {
      // Re-throw known exceptions
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(
        `Error cancelling invitation: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('Failed to cancel invitation');
    }
  }
}

