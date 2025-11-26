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

    // Extract API key and secret from headers
    const apiKey = request.headers['x-api-key'];
    const apiSecret = request.headers['x-api-secret'];

    if (!apiKey || !apiSecret) {
      this.logger.warn('API key or secret missing from request headers');
      throw new UnauthorizedException('API key and secret are required');
    }

    // Validate API key and secret
    const user = await this.apiKeyService.validateApiKey(apiKey, apiSecret);

    if (!user) {
      this.logger.warn('Invalid API key or secret provided');
      throw new UnauthorizedException('Invalid API key or secret');
    }

    // Set user in request context (mimics JWT auth behavior)
    request.user = user;
    request.apiKeyAuth = true; // Flag to indicate this was API key auth

    this.logger.debug(`API key authentication successful for user ${user.id}`);
    return true;
  }
}

