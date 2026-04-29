import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { RedisService } from '../../../common/redis/redis.service';

@Injectable()
export class ApiKeyRateLimitGuard implements CanActivate {
  private readonly logger = new Logger(ApiKeyRateLimitGuard.name);
  private readonly limit = parseInt(
    process.env.API_KEY_RATE_LIMIT || '1000',
    10,
  ); // requests per window
  private readonly ttl = parseInt(
    process.env.API_KEY_RATE_TTL_SECONDS || '60',
    10,
  ); // window length in seconds

  constructor(private readonly redisService: RedisService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // Get API key ID from request (set by ApiKeyGuard)
    const apiKeyId = request.apiKeyId;

    if (!apiKeyId) {
      // If no API key ID, allow through (ApiKeyGuard will handle authentication)
      // This guard only applies rate limiting after successful authentication
      return true;
    }

    const redisKey = `api-key-rate-limit:${apiKeyId}`;

    try {
      // Increment request count
      const count = await this.redisService.incr(redisKey);

      // If this is the first request in the window, set expiration
      if (count === 1) {
        await this.redisService.expire(redisKey, this.ttl);
      }

      // Check if limit exceeded
      if (count > this.limit) {
        this.logger.warn(
          `Rate limit exceeded for API key ${apiKeyId}: ${count} requests in ${this.ttl} seconds`,
        );
        throw new HttpException(
          `Rate limit exceeded. Maximum ${this.limit} requests per ${this.ttl} seconds.`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      return true;
    } catch (error) {
      // If error is HttpException with 429 status, rethrow it
      if (
        error instanceof HttpException &&
        error.getStatus() === HttpStatus.TOO_MANY_REQUESTS
      ) {
        throw error;
      }

      // For Redis errors, log and allow request through (fail open)
      // Rate limiting should not break functionality if Redis is down
      this.logger.error(
        `Redis error in rate limiting for API key ${apiKeyId}: ${error.message}`,
        error.stack,
      );
      return true;
    }
  }
}

