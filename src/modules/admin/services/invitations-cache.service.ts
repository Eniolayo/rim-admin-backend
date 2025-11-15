import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import { RedisService } from '../../../common/redis/redis.service';
import { RedisConfig } from '../../../config/redis.config';
import {
  AdminInvitationResponseDto,
  VerifyInviteResponseDto,
} from '../dto/invitation.dto';

@Injectable()
export class InvitationsCacheService {
  private readonly defaultTtl: number;
  private readonly cachePrefix = 'invitations:';

  constructor(
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
    private readonly logger: Logger,
  ) {
    const redisConfig = this.configService.get<RedisConfig>('redis');
    this.defaultTtl = redisConfig?.ttl || 3600;
  }

  /**
   * Generate cache key for invitations list
   */
  private getInvitationsListKey(): string {
    return `${this.cachePrefix}list`;
  }

  /**
   * Generate cache key for verify token
   */
  private getVerifyTokenKey(token: string): string {
    return `${this.cachePrefix}verify:${token}`;
  }

  /**
   * Get cached invitations list
   */
  async getInvitationsList(): Promise<AdminInvitationResponseDto[] | null> {
    const cacheKey = this.getInvitationsListKey();
    try {
      const cached = await this.redisService.getJson<
        AdminInvitationResponseDto[]
      >(cacheKey);
      if (cached) {
        this.logger.debug(
          { cacheKey, operation: 'cache_hit' },
          'Cache hit for invitations list',
        );
        return cached;
      }
      this.logger.debug(
        { cacheKey, operation: 'cache_miss' },
        'Cache miss for invitations list',
      );
      return null;
    } catch (error) {
      this.logger.warn(
        {
          cacheKey,
          error: error instanceof Error ? error.message : String(error),
          operation: 'cache_error',
        },
        'Error getting invitations list from cache',
      );
      return null;
    }
  }

  /**
   * Cache invitations list
   */
  async setInvitationsList(
    data: AdminInvitationResponseDto[],
    ttl?: number,
  ): Promise<void> {
    const cacheKey = this.getInvitationsListKey();
    try {
      await this.redisService.setJson(cacheKey, data, ttl || this.defaultTtl);
      this.logger.debug(
        { cacheKey, ttl: ttl || this.defaultTtl, operation: 'cache_set' },
        'Cache set for invitations list',
      );
    } catch (error) {
      this.logger.warn(
        {
          cacheKey,
          error: error instanceof Error ? error.message : String(error),
          operation: 'cache_error',
        },
        'Error setting invitations list in cache',
      );
    }
  }

  /**
   * Get cached verify token response
   */
  async getVerifyToken(
    token: string,
  ): Promise<VerifyInviteResponseDto | null> {
    const cacheKey = this.getVerifyTokenKey(token);
    try {
      const cached = await this.redisService.getJson<VerifyInviteResponseDto>(
        cacheKey,
      );
      if (cached) {
        this.logger.debug(
          { cacheKey, operation: 'cache_hit' },
          'Cache hit for verify token',
        );
        return cached;
      }
      this.logger.debug(
        { cacheKey, operation: 'cache_miss' },
        'Cache miss for verify token',
      );
      return null;
    } catch (error) {
      this.logger.warn(
        {
          cacheKey,
          error: error instanceof Error ? error.message : String(error),
          operation: 'cache_error',
        },
        'Error getting verify token from cache',
      );
      return null;
    }
  }

  /**
   * Cache verify token response
   */
  async setVerifyToken(
    token: string,
    data: VerifyInviteResponseDto,
    ttl?: number,
  ): Promise<void> {
    const cacheKey = this.getVerifyTokenKey(token);
    try {
      await this.redisService.setJson(cacheKey, data, ttl || this.defaultTtl);
      this.logger.debug(
        { cacheKey, ttl: ttl || this.defaultTtl, operation: 'cache_set' },
        'Cache set for verify token',
      );
    } catch (error) {
      this.logger.warn(
        {
          cacheKey,
          error: error instanceof Error ? error.message : String(error),
          operation: 'cache_error',
        },
        'Error setting verify token in cache',
      );
    }
  }

  /**
   * Invalidate invitations list cache
   */
  async invalidateInvitationsList(): Promise<void> {
    const cacheKey = this.getInvitationsListKey();
    try {
      await this.redisService.del(cacheKey);
      this.logger.debug(
        { cacheKey, operation: 'cache_invalidate' },
        'Cache invalidated for invitations list',
      );
    } catch (error) {
      this.logger.warn(
        {
          cacheKey,
          error: error instanceof Error ? error.message : String(error),
          operation: 'cache_error',
        },
        'Error invalidating invitations list cache',
      );
    }
  }

  /**
   * Invalidate verify token cache
   */
  async invalidateVerifyToken(token: string): Promise<void> {
    const cacheKey = this.getVerifyTokenKey(token);
    try {
      await this.redisService.del(cacheKey);
      this.logger.debug(
        { cacheKey, operation: 'cache_invalidate' },
        'Cache invalidated for verify token',
      );
    } catch (error) {
      this.logger.warn(
        {
          cacheKey,
          error: error instanceof Error ? error.message : String(error),
          operation: 'cache_error',
        },
        'Error invalidating verify token cache',
      );
    }
  }

  /**
   * Invalidate all invitation-related caches
   */
  async invalidateAll(): Promise<void> {
    const pattern = `${this.cachePrefix}*`;
    try {
      await this.redisService.delPattern(pattern);
      this.logger.debug(
        { pattern, operation: 'cache_invalidate' },
        'Cache invalidated for all invitations',
      );
    } catch (error) {
      this.logger.warn(
        {
          pattern,
          error: error instanceof Error ? error.message : String(error),
          operation: 'cache_error',
        },
        'Error invalidating all invitation caches',
      );
    }
  }
}

