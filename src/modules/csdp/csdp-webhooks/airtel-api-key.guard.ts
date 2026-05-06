import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Validates the `Authorization: ApiKey {api-key}` header on the
 * Airtel-facing webhook routes.
 *
 * Per docs/AIRTEL_CSDP_INTEGRATION_API.md §2/§3, Airtel sends:
 *   `Authorization: ApiKey <key>`
 *
 * This is distinct from the existing internal `x-csdp-api-key` header
 * (see `CsdpApiKeyGuard`) — Airtel's contract doesn't accept that
 * vendor-specific header name, so a separate guard is needed.
 *
 * The expected key is read from env (`AIRTEL_WEBHOOK_API_KEY`). It is
 * never logged. In non-production with the env var unset, the guard
 * lets the request through with a warning so local dev / staging
 * smoke tests don't require the real key.
 */
@Injectable()
export class AirtelApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(AirtelApiKeyGuard.name);

  constructor(private readonly config: ConfigService) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const expected = this.config.get<string>('AIRTEL_WEBHOOK_API_KEY');

    const header: string | undefined = req.headers['authorization'];
    const providedKey = this.extractApiKey(header);

    if (!expected) {
      if (this.config.get('NODE_ENV') === 'production') {
        throw new UnauthorizedException('AIRTEL_WEBHOOK_API_KEY not configured');
      }
      this.logger.warn(
        'AIRTEL_WEBHOOK_API_KEY is not set — skipping auth check (non-production)',
      );
      return true;
    }

    if (!providedKey || providedKey !== expected) {
      throw new UnauthorizedException('Invalid Airtel webhook API key');
    }

    return true;
  }

  /**
   * Extracts the key from a header of the form `ApiKey <token>`.
   * Returns null for any malformed or missing input. Token comparison
   * is exact (no whitespace tolerance beyond a single separator).
   */
  private extractApiKey(header: string | undefined): string | null {
    if (!header) return null;
    const m = /^ApiKey\s+(.+)$/.exec(header);
    return m ? m[1].trim() : null;
  }
}
