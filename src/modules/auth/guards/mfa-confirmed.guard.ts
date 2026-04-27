import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { authenticator } from 'otplib';

@Injectable()
export class MfaConfirmedGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const user = req.user;

    if (!user) {
      throw new ForbiddenException('MFA not enrolled for this user');
    }

    if (!user.otpSecret || !user.twoFactorEnabled) {
      throw new ForbiddenException('MFA not enrolled for this user');
    }

    const code: string | undefined = req.headers['x-mfa-code'];

    if (!code) {
      throw new UnauthorizedException('MFA code required (x-mfa-code header)');
    }

    const valid = authenticator.check(code, user.otpSecret);
    if (!valid) {
      throw new UnauthorizedException('Invalid MFA code');
    }

    return true;
  }
}
