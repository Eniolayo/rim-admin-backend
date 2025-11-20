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
import { AdminMgmtUserRepository } from '../repositories/user.repository';
import {
  AdminInvitation,
  AdminInvitationRole,
  AdminInvitationStatus,
} from '../../../entities/admin-invitation.entity';
import {
  AdminUser,
  AdminUserStatus,
} from '../../../entities/admin-user.entity';
import {
  InviteAdminDto,
  AdminInvitationResponseDto,
  VerifyInviteResponseDto,
  SetupAdminAccountDto,
  SetupAdminAccountResponseDto,
} from '../dto/invitation.dto';
import { AdminUserResponseDto } from '../dto/admin-user.dto';
import { InvitationsCacheService } from './invitations-cache.service';
import {
  formatRoleName,
  formatRoleNameNullable,
} from '../../../common/utils/role.utils';
import { EmailService } from '../../email/email.service';

@Injectable()
export class InvitationsService {
  constructor(
    private readonly invitationRepository: InvitationRepository,
    private readonly roleRepository: AdminRoleRepository,
    private readonly adminUserRepository: AdminUserRepository,
    private readonly adminMgmtUserRepository: AdminMgmtUserRepository,
    private readonly cacheService: InvitationsCacheService,
    private readonly emailService: EmailService,
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
    roleName?: string | null,
  ): AdminInvitationResponseDto {
    return {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      roleId: invitation.roleId,
      roleName: formatRoleNameNullable(roleName),
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

  private generateToken(): string {
    return randomBytes(32).toString('hex');
  }

  async inviteAdmin(
    dto: InviteAdminDto,
    invitedBy: AdminUser,
  ): Promise<AdminInvitationResponseDto> {
    try {
      this.logger.log(
        `Inviting admin: email=${dto.email}, roleId=${dto.roleId}, invitedBy=${invitedBy.id}`,
      );

      // Check if email already has a pending invitation
      const existingInvitation = await this.invitationRepository.findByEmail(
        dto.email,
        AdminInvitationStatus.PENDING,
      );

      if (existingInvitation) {
        this.logger.warn(
          `Duplicate invitation attempt for email: ${dto.email}`,
        );
        throw new BadRequestException('This email has already been invited');
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

      // Find role by ID
      const role = await this.roleRepository.findById(dto.roleId);
      if (!role) {
        this.logger.error(`Role not found: ${dto.roleId}`);
        throw new NotFoundException(
          `Role with ID '${dto.roleId}' not found in system`,
        );
      }

      // Generate secure token
      const token = this.generateToken();

      // Create invitation with 7-day expiration
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const invitation = new AdminInvitation();
      invitation.email = dto.email;
      invitation.role = null; // Legacy field, kept for backward compatibility
      invitation.roleId = role.id;
      invitation.inviteToken = token;
      invitation.invitedBy = invitedBy.id;
      invitation.invitedByName = invitedBy.username;
      invitation.expiresAt = expiresAt;
      invitation.status = AdminInvitationStatus.PENDING;

      const saved = await this.invitationRepository.create(invitation);

      // Invalidate list cache after creating new invitation
      await this.cacheService.invalidateInvitationsList();

      // Send invitation email
      try {
        await this.emailService.sendAdminInvitationEmail(
          saved.email,
          saved.inviteToken,
          role.name,
          saved.invitedByName,
          saved.expiresAt,
        );
        this.logger.log(`Invitation email sent to ${saved.email}`);
      } catch (emailError) {
        // Log error but don't fail the invitation creation
        this.logger.error(
          `Failed to send invitation email to ${saved.email}: ${emailError.message}`,
          emailError.stack,
        );
      }

      this.logger.log(`Successfully created invitation: ${saved.id}`);
      return this.toInvitationDto(saved, role.name);
    } catch (error) {
      // Re-throw known exceptions
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      this.logger.error(`Error inviting admin: ${error.message}`, error.stack);
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

      // Fetch all unique role IDs (filter out null/undefined)
      const roleIds = [
        ...new Set(
          invitations
            .map((inv) => inv.roleId)
            .filter((id): id is string => Boolean(id)),
        ),
      ];

      // Fetch all roles in one query
      const rolesMap = new Map<string, string>();
      if (roleIds.length > 0) {
        const roles = await Promise.all(
          roleIds.map((id) => this.roleRepository.findById(id)),
        );
        roles.forEach((role) => {
          if (role) {
            rolesMap.set(role.id, role.name);
          }
        });
      }

      // Map invitations with role names
      const result = invitations.map((inv) =>
        this.toInvitationDto(
          inv,
          inv.roleId ? (rolesMap.get(inv.roleId) ?? null) : null,
        ),
      );

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

      // Fetch role name if roleId exists
      let roleName: string | null = null;
      if (invitation.roleId) {
        try {
          const role = await this.roleRepository.findById(invitation.roleId);
          roleName = role?.name ?? null;
        } catch (error) {
          this.logger.warn(
            `Failed to fetch role for invitation ${invitation.id}: ${error.message}`,
          );
        }
      }

      const result = {
        valid: true,
        invitation: this.toInvitationDto(invitation, roleName),
      };

      // Cache the result
      await this.cacheService.setVerifyToken(token, result);

      return result;
    } catch (error) {
      this.logger.error(`Error verifying token: ${error.message}`, error.stack);
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

      // Find role by ID (preferred) or fall back to enum mapping for backward compatibility
      let role;
      if (invitation.roleId) {
        role = await this.roleRepository.findById(invitation.roleId);
      } else if (invitation.role) {
        // Legacy support: convert enum role to role name
        const backendRoleName = this.enumToRoleName(invitation.role);
        role = await this.roleRepository.findByName(backendRoleName);
      }

      if (!role) {
        this.logger.error(`Role not found for invitation: ${invitation.id}`);
        throw new InternalServerErrorException(
          `Role not found in system for this invitation`,
        );
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(dto.password, 10);

      // Generate username from name
      const username = dto.name.toLowerCase().replace(/\s+/g, '.');

      // Check if username already exists
      const existingUsername =
        await this.adminUserRepository.findByUsername(username);
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
      newAdmin.role = role.name;
      newAdmin.roleId = role.id;
      newAdmin.status = AdminUserStatus.ACTIVE;
      newAdmin.twoFactorEnabled = false; // CRITICAL: Force 2FA setup on first login
      newAdmin.otpSecret = null;
      newAdmin.lastLogin = null;
      newAdmin.createdBy = invitation.invitedBy;

      const savedUser = await this.adminUserRepository.save(newAdmin);

      // Update role userCount
      const updatedRole = await this.roleRepository.findById(role.id);
      if (updatedRole) {
        const userCount = await this.adminMgmtUserRepository.countByRole(
          role.id,
        );
        updatedRole.userCount = userCount;
        await this.roleRepository.save(updatedRole);
      }

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
        throw new BadRequestException('Can only resend pending invitations');
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

      // Fetch role name if roleId exists
      let roleName: string | null = null;
      if (updated.roleId) {
        try {
          const role = await this.roleRepository.findById(updated.roleId);
          roleName = role?.name ?? null;

          // Send invitation email
          try {
            await this.emailService.sendAdminInvitationEmail(
              updated.email,
              updated.inviteToken,
              roleName || 'Admin',
              updated.invitedByName,
              updated.expiresAt,
            );
            this.logger.log(`Resent invitation email to ${updated.email}`);
          } catch (emailError) {
            // Log error but don't fail the resend operation
            this.logger.error(
              `Failed to send resend invitation email to ${updated.email}: ${emailError.message}`,
              emailError.stack,
            );
          }
        } catch (error) {
          this.logger.warn(
            `Failed to fetch role for invitation ${updated.id}: ${error.message}`,
          );
        }
      }

      this.logger.log(`Successfully resent invitation: ${id}`);
      return this.toInvitationDto(updated, roleName);
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
// npm run migration:generate -- src/database/migrations/AddRoleIdToAdminInvitations
