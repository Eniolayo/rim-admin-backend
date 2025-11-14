import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AdminUser } from '../../../entities/admin-user.entity';

@Injectable()
export class AdminTwoFactorGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest();
    const user: AdminUser | undefined = req.user;
    if (!user) return false;

    if (!user.twoFactorEnabled || !user.otpSecret) {
      throw new ForbiddenException('Two-factor authentication required');
    }
    return true;
  }
}

