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

    // Extract API token from header
    const token = request.headers['x-api-token'];

    if (!token) {
      this.logger.warn('API token missing from request headers');
      throw new UnauthorizedException('API token is required');
    }

    // Validate token length (should be 96 characters)
    if (token.length !== 96) {
      this.logger.warn('Invalid API token length');
      throw new UnauthorizedException('Invalid API token format');
    }

    // Validate API token
    const result = await this.apiKeyService.validateApiToken(token);

    if (!result) {
      this.logger.warn('Invalid API token provided');
      throw new UnauthorizedException('Invalid API token');
    }

    // Set user and API key in request context
    request.user = result.user;
    request.apiKeyId = result.apiKey.id; // For rate limiting guard
    request.apiKeyAuth = true; // Flag to indicate this was API key auth

    this.logger.debug(`API token authentication successful for user ${result.user.id}`);
    return true;
  }
}

