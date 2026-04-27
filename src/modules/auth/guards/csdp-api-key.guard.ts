import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class CsdpApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(CsdpApiKeyGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
  ) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const required: string[] =
      this.reflector.getAllAndOverride<string[]>('csdpScopes', [
        ctx.getHandler(),
        ctx.getClass(),
      ]) ?? [];

    const expected = this.config.get<string>('CSDP_API_KEY');
    const provided = req.headers['x-csdp-api-key'] as string | undefined;
    const scopes = (
      this.config.get<string>('CSDP_API_KEY_SCOPES') ??
      'csdp:profile,csdp:webhook,csdp:ingest'
    )
      .split(',')
      .map((s) => s.trim());

    if (!expected) {
      if (this.config.get('NODE_ENV') === 'production') {
        throw new UnauthorizedException('CSDP_API_KEY not configured');
      }
      // Dev convenience: allow but warn
      this.logger.warn(
        'CSDP_API_KEY is not set — skipping auth check (non-production)',
      );
      return true;
    }

    if (!provided || provided !== expected) {
      throw new UnauthorizedException('Invalid CSDP API key');
    }

    if (required.length && !required.every((s) => scopes.includes(s))) {
      throw new ForbiddenException(`Missing scope: ${required.join(',')}`);
    }

    req.csdpScopes = scopes;
    return true;
  }
}
