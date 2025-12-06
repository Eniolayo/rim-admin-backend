import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { ApiKeyService } from '../services/api-key.service';

/**
 * Guard that accepts either JWT Bearer token or API key authentication.
 * Tries API key first (if x-api-token header is present), then falls back to JWT.
 */
@Injectable()
export class JwtOrApiKeyGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtOrApiKeyGuard.name);

  constructor(
    private reflector: Reflector,
    private readonly apiKeyService: ApiKeyService,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();

    // Allow OPTIONS requests (CORS preflight) to pass through
    if (request.method === 'OPTIONS') {
      return true;
    }

    // Check for API key first
    const apiToken = request.headers['x-api-token'];

    if (apiToken) {
      this.logger.log(
        `JwtOrApiKeyGuard: API token detected - method: ${request.method}, path: ${request.path}`,
      );

      // Validate API token length (should be 96 characters)
      if (apiToken.length !== 96) {
        this.logger.warn(
          `Invalid API token length - expected 96, got ${apiToken.length}`,
        );
        // Fall through to JWT authentication
      } else {
        // Validate API token
        const result = await this.apiKeyService.validateApiToken(apiToken);

        if (result) {
          // Set user and API key in request context
          request.user = result.user;
          request.apiKeyId = result.apiKey.id;
          request.apiKeyAuth = true;

          this.logger.debug(
            `API token authentication successful for user ${result.user.id}`,
          );
          return true;
        } else {
          this.logger.warn(
            `API token validation failed, falling back to JWT authentication`,
          );
        }
      }
    }

    // Fall back to JWT authentication
    try {
      const jwtResult = await super.canActivate(context);
      if (jwtResult) {
        return true;
      }
      // JWT authentication returned false
      throw new UnauthorizedException(
        'Authentication required. Provide either a valid JWT token or API key.',
      );
    } catch (error) {
      // JWT authentication failed
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.warn(
        `JWT authentication failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new UnauthorizedException(
        'Authentication required. Provide either a valid JWT token or API key.',
      );
    }
  }
}
