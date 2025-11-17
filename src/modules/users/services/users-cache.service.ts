import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import { RedisService } from '../../../common/redis/redis.service';
import { RedisConfig } from '../../../config/redis.config';
import {
  UserResponseDto,
  UserQueryDto,
  UserStatsDto,
  PaginatedResponseDto,
} from '../dto';
import * as crypto from 'crypto';

@Injectable()
export class UsersCacheService {
  private readonly defaultTtl: number;
  private readonly cachePrefix = 'users:';

  constructor(
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
    private readonly logger: Logger,
  ) {
    const redisConfig = this.configService.get<RedisConfig>('redis');
    this.defaultTtl = redisConfig?.ttl || 3600;
  }

  /**
   * Generate cache key for a single user
   */
  private getUserKey(id: string): string {
    return `${this.cachePrefix}${id}`;
  }

  /**
   * Generate cache key for user list based on query parameters
   */
  private getUserListKey(query?: UserQueryDto): string {
    if (!query || Object.keys(query).length === 0) {
      return `${this.cachePrefix}list:default`;
    }

    // Create a normalized query object for consistent hashing
    const normalizedQuery = {
      status: query.status || null,
      repaymentStatus: query.repaymentStatus || null,
      search: query.search || null,
      minCreditScore: query.minCreditScore ?? null,
      maxCreditScore: query.maxCreditScore ?? null,
      page: query.page ?? 1,
      limit: query.limit ?? 10,
    };

    // Sort keys to ensure consistent hash
    const sortedKeys = Object.keys(normalizedQuery).sort();
    const sortedQuery: Record<string, unknown> = {};
    for (const key of sortedKeys) {
      sortedQuery[key] = normalizedQuery[key as keyof typeof normalizedQuery];
    }
    const queryString = JSON.stringify(sortedQuery);
    const hash = crypto.createHash('md5').update(queryString).digest('hex');
    return `${this.cachePrefix}list:${hash}`;
  }

  /**
   * Generate cache key for user stats
   */
  private getUserStatsKey(): string {
    return `${this.cachePrefix}stats`;
  }

  /**
   * Get cached user by ID
   */
  async getUser(id: string): Promise<UserResponseDto | null> {
    const cacheKey = this.getUserKey(id);
    try {
      const cached = await this.redisService.getJson<UserResponseDto>(cacheKey);
      if (cached) {
        this.logger.debug({ cacheKey, operation: 'cache_hit' }, 'Cache hit');
        return cached;
      }
      this.logger.debug({ cacheKey, operation: 'cache_miss' }, 'Cache miss');
      return null;
    } catch (error) {
      this.logger.warn(
        { cacheKey, error: error.message, operation: 'cache_error' },
        'Error getting user from cache',
      );
      return null;
    }
  }

  /**
   * Cache user by ID
   */
  async setUser(
    id: string,
    user: UserResponseDto,
    ttl?: number,
  ): Promise<void> {
    const cacheKey = this.getUserKey(id);
    try {
      await this.redisService.setJson(cacheKey, user, ttl || this.defaultTtl);
      this.logger.debug(
        { cacheKey, ttl: ttl || this.defaultTtl, operation: 'cache_set' },
        'Cache set',
      );
    } catch (error) {
      this.logger.warn(
        { cacheKey, error: error.message, operation: 'cache_error' },
        'Error setting user in cache',
      );
    }
  }

  /**
   * Get cached user list
   */
  async getUserList(
    query?: UserQueryDto,
  ): Promise<PaginatedResponseDto<UserResponseDto> | null> {
    const cacheKey = this.getUserListKey(query);
    try {
      const cached = await this.redisService.getJson<
        PaginatedResponseDto<UserResponseDto>
      >(cacheKey);
      if (cached) {
        this.logger.debug({ cacheKey, operation: 'cache_hit' }, 'Cache hit');
        return cached;
      }
      this.logger.debug({ cacheKey, operation: 'cache_miss' }, 'Cache miss');
      return null;
    } catch (error) {
      this.logger.warn(
        { cacheKey, error: error.message, operation: 'cache_error' },
        'Error getting user list from cache',
      );
      return null;
    }
  }

  /**
   * Cache user list
   */
  async setUserList(
    query: UserQueryDto | undefined,
    data: PaginatedResponseDto<UserResponseDto>,
    ttl?: number,
  ): Promise<void> {
    const cacheKey = this.getUserListKey(query);
    try {
      await this.redisService.setJson(cacheKey, data, ttl || this.defaultTtl);
      this.logger.debug(
        { cacheKey, ttl: ttl || this.defaultTtl, operation: 'cache_set' },
        'Cache set',
      );
    } catch (error) {
      this.logger.warn(
        { cacheKey, error: error.message, operation: 'cache_error' },
        'Error setting user list in cache',
      );
    }
  }

  /**
   * Get cached user stats
   */
  async getUserStats(): Promise<UserStatsDto | null> {
    const cacheKey = this.getUserStatsKey();
    try {
      const cached = await this.redisService.getJson<UserStatsDto>(cacheKey);
      if (cached) {
        this.logger.debug({ cacheKey, operation: 'cache_hit' }, 'Cache hit');
        return cached;
      }
      this.logger.debug({ cacheKey, operation: 'cache_miss' }, 'Cache miss');
      return null;
    } catch (error) {
      this.logger.warn(
        { cacheKey, error: error.message, operation: 'cache_error' },
        'Error getting user stats from cache',
      );
      return null;
    }
  }

  /**
   * Cache user stats
   */
  async setUserStats(stats: UserStatsDto, ttl?: number): Promise<void> {
    const cacheKey = this.getUserStatsKey();
    try {
      await this.redisService.setJson(cacheKey, stats, ttl || this.defaultTtl);
      this.logger.debug(
        { cacheKey, ttl: ttl || this.defaultTtl, operation: 'cache_set' },
        'Cache set',
      );
    } catch (error) {
      this.logger.warn(
        { cacheKey, error: error.message, operation: 'cache_error' },
        'Error setting user stats in cache',
      );
    }
  }

  /**
   * Invalidate single user cache
   */
  async invalidateUser(id: string): Promise<void> {
    const cacheKey = this.getUserKey(id);
    try {
      await this.redisService.del(cacheKey);
      this.logger.debug(
        { cacheKey, operation: 'cache_invalidate' },
        'Cache invalidated',
      );
    } catch (error) {
      this.logger.warn(
        { cacheKey, error: error.message, operation: 'cache_error' },
        'Error invalidating user cache',
      );
    }
  }

  /**
   * Invalidate all user list caches
   */
  async invalidateUserList(): Promise<void> {
    const pattern = `${this.cachePrefix}list:*`;
    try {
      await this.redisService.delPattern(pattern);
      this.logger.debug(
        { pattern, operation: 'cache_invalidate' },
        'Cache invalidated',
      );
    } catch (error) {
      this.logger.warn(
        { pattern, error: error.message, operation: 'cache_error' },
        'Error invalidating user list cache',
      );
    }
  }

  /**
   * Invalidate user stats cache
   */
  async invalidateUserStats(): Promise<void> {
    const cacheKey = this.getUserStatsKey();
    try {
      await this.redisService.del(cacheKey);
      this.logger.debug(
        { cacheKey, operation: 'cache_invalidate' },
        'Cache invalidated',
      );
    } catch (error) {
      this.logger.warn(
        { cacheKey, error: error.message, operation: 'cache_error' },
        'Error invalidating user stats cache',
      );
    }
  }

  /**
   * Invalidate all user-related caches
   */
  async invalidateAll(): Promise<void> {
    const pattern = `${this.cachePrefix}*`;
    try {
      await this.redisService.delPattern(pattern);
      this.logger.debug(
        { pattern, operation: 'cache_invalidate' },
        'Cache invalidated',
      );
    } catch (error) {
      this.logger.warn(
        { pattern, error: error.message, operation: 'cache_error' },
        'Error invalidating all user caches',
      );
    }
  }
}

