import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ApiKeyService } from '../services/api-key.service';
import { AdminUser } from '../../../entities/admin-user.entity';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(ApiKeyGuard.name);

  constructor(private readonly apiKeyService: ApiKeyService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // Allow OPTIONS requests (CORS preflight) to pass through
    if (request.method === 'OPTIONS') {
      return true;
    }

    // Extract API token from header
    const token = request.headers['x-api-token'];

    this.logger.log(
      `ApiKeyGuard: Processing request - method: ${request.method}, path: ${request.path}, hasToken: ${!!token}, tokenLength: ${token ? token.length : 0}`,
    );

    if (!token) {
      this.logger.warn('API token missing from request headers');
      throw new UnauthorizedException('API token is required');
    }

    // Validate token length (should be 96 characters)
    if (token.length !== 96) {
      this.logger.warn(
        `Invalid API token length - expected 96, got ${token.length}`,
      );
      throw new UnauthorizedException('Invalid API token format');
    }

    const tokenPrefix = token.substring(0, 8);
    this.logger.log(
      `ApiKeyGuard: Validating token - prefix: ${tokenPrefix}, fullTokenLength: ${token.length}`,
    );

    // Validate API token
    const result = await this.apiKeyService.validateApiToken(token);

    if (!result) {
      this.logger.warn(
        `Invalid API token provided - tokenPrefix: ${tokenPrefix}, validation returned null`,
      );
      throw new UnauthorizedException('Invalid API token');
    }

    // Set user and API key in request context
    request.user = result.user;
    request.apiKeyId = result.apiKey.id; // For rate limiting guard
    request.apiKeyAuth = true; // Flag to indicate this was API key auth

    this.logger.debug(
      `API token authentication successful for user ${result.user.id}`,
    );
    return true;
  }
}
