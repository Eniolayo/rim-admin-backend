import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminUser } from '../../../entities/admin-user.entity';
import { Permission } from '../../../entities/admin-role.entity';
import {
  PERMISSIONS_KEY,
  PermissionMetadata,
} from '../decorators/permissions.decorator';
import {
  REQUIRE_SUPER_ADMIN_KEY,
} from '../decorators/require-super-admin.decorator';
import {
  REQUIRE_SUPPORT_AGENT_KEY,
} from '../decorators/require-support-agent.decorator';
import {
  REQUIRE_FINANCE_OFFICER_KEY,
} from '../decorators/require-finance-officer.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  private readonly logger = new Logger(PermissionsGuard.name);

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user: AdminUser = request.user;

    if (!user) {
      this.logger.warn('No user found in request context');
      throw new ForbiddenException('User not authenticated');
    }

    // Check for role-specific requirements (order matters - most restrictive first)
    const requireSuperAdmin = this.reflector.getAllAndOverride<boolean>(
      REQUIRE_SUPER_ADMIN_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (requireSuperAdmin) {
      return this.checkSuperAdmin(user);
    }

    const requireSupportAgent = this.reflector.getAllAndOverride<boolean>(
      REQUIRE_SUPPORT_AGENT_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (requireSupportAgent) {
      return this.checkSupportAgent(user);
    }

    const requireFinanceOfficer = this.reflector.getAllAndOverride<boolean>(
      REQUIRE_FINANCE_OFFICER_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (requireFinanceOfficer) {
      return this.checkFinanceOfficer(user);
    }

    // Check for permission-based access
    const permissionMetadata = this.reflector.getAllAndOverride<PermissionMetadata>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (permissionMetadata) {
      return this.checkPermission(user, permissionMetadata);
    }

    // If no permission decorators are present, allow access
    // (assuming JwtAuthGuard already validated authentication)
    return true;
  }

  private checkSuperAdmin(user: AdminUser): boolean {
    if (!user.roleEntity) {
      this.logger.warn(`User ${user.id} has no role entity loaded`);
      throw new ForbiddenException('User role not found');
    }

    const roleName = user.roleEntity.name.toLowerCase().trim();
    const isSuperAdmin = roleName === 'super_admin';

    if (!isSuperAdmin) {
      this.logger.warn(
        `User ${user.id} (role: ${user.roleEntity.name}) attempted to access super admin endpoint`,
      );
      throw new ForbiddenException('Insufficient permissions: Super admin access required');
    }

    this.logger.debug(`Super admin access granted for user ${user.id}`);
    return true;
  }

  private checkSupportAgent(user: AdminUser): boolean {
    if (!user.roleEntity) {
      this.logger.warn(`User ${user.id} has no role entity loaded`);
      throw new ForbiddenException('User role not found');
    }

    const roleName = user.roleEntity.name.toLowerCase().trim();
    const isModerator = roleName === 'moderator';

    if (!isModerator) {
      this.logger.warn(
        `User ${user.id} (role: ${user.roleEntity.name}) attempted to access moderator endpoint`,
      );
      throw new ForbiddenException('Insufficient permissions: Moderator access required');
    }

    this.logger.debug(`Moderator access granted for user ${user.id}`);
    return true;
  }

  private checkFinanceOfficer(user: AdminUser): boolean {
    if (!user.roleEntity) {
      this.logger.warn(`User ${user.id} has no role entity loaded`);
      throw new ForbiddenException('User role not found');
    }

    const roleName = user.roleEntity.name.toLowerCase().trim();
    const isAdmin = roleName === 'admin';

    if (!isAdmin) {
      this.logger.warn(
        `User ${user.id} (role: ${user.roleEntity.name}) attempted to access admin endpoint`,
      );
      throw new ForbiddenException('Insufficient permissions: Admin access required');
    }

    this.logger.debug(`Admin access granted for user ${user.id}`);
    return true;
  }

  private checkPermission(
    user: AdminUser,
    required: PermissionMetadata,
  ): boolean {
    if (!user.roleEntity) {
      this.logger.warn(`User ${user.id} has no role entity loaded`);
      throw new ForbiddenException('User role not found');
    }

    if (!user.roleEntity.permissions || user.roleEntity.permissions.length === 0) {
      this.logger.warn(
        `User ${user.id} (role: ${user.roleEntity.name}) has no permissions`,
      );
      throw new ForbiddenException('Insufficient permissions');
    }

    // Find permission for the required resource
    const resourcePermission = user.roleEntity.permissions.find(
      (perm: Permission) => perm.resource === required.resource,
    );

    if (!resourcePermission) {
      this.logger.warn(
        `User ${user.id} (role: ${user.roleEntity.name}) lacks permission for resource: ${required.resource}`,
      );
      throw new ForbiddenException(
        `Insufficient permissions: Access to resource '${required.resource}' is required`,
      );
    }

    // Check if user has all required actions
    const hasAllActions = required.actions.every((action) =>
      resourcePermission.actions.includes(action),
    );

    if (!hasAllActions) {
      this.logger.warn(
        `User ${user.id} (role: ${user.roleEntity.name}) lacks required actions for resource: ${required.resource}. Required: ${required.actions.join(', ')}, Has: ${resourcePermission.actions.join(', ')}`,
      );
      throw new ForbiddenException(
        `Insufficient permissions: Required actions [${required.actions.join(', ')}] for resource '${required.resource}'`,
      );
    }

    this.logger.debug(
      `Permission check passed for user ${user.id}: resource=${required.resource}, actions=${required.actions.join(', ')}`,
    );
    return true;
  }
}

