import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import { RedisService } from '../../../common/redis/redis.service';
import { RedisConfig } from '../../../config/redis.config';
import {
  LoanResponseDto,
  LoanQueryDto,
  LoanStatsDto,
} from '../dto';
import { PaginatedResponseDto } from '../../users/dto/paginated-response.dto';
import * as crypto from 'crypto';

@Injectable()
export class LoansCacheService {
  private readonly defaultTtl: number;
  private readonly cachePrefix = 'loans:';

  constructor(
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
    private readonly logger: Logger,
  ) {
    const redisConfig = this.configService.get<RedisConfig>('redis');
    this.defaultTtl = redisConfig?.ttl || 3600;
  }

  /**
   * Generate cache key for a single loan
   */
  private getLoanKey(id: string): string {
    return `${this.cachePrefix}${id}`;
  }

  /**
   * Generate cache key for loan list based on query parameters
   */
  private getLoanListKey(query?: LoanQueryDto): string {
    if (!query || Object.keys(query).length === 0) {
      return `${this.cachePrefix}list:default`;
    }

    // Create a normalized query object for consistent hashing
    const normalizedQuery = {
      status: query.status || null,
      network: query.network || null,
      search: query.search || null,
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
   * Generate cache key for loan stats
   */
  private getLoanStatsKey(): string {
    return `${this.cachePrefix}stats`;
  }

  /**
   * Get cached loan by ID
   */
  async getLoan(id: string): Promise<LoanResponseDto | null> {
    const cacheKey = this.getLoanKey(id);
    try {
      const cached = await this.redisService.getJson<LoanResponseDto>(cacheKey);
      if (cached) {
        this.logger.debug({ cacheKey, operation: 'cache_hit' }, 'Cache hit');
        return cached;
      }
      this.logger.debug({ cacheKey, operation: 'cache_miss' }, 'Cache miss');
      return null;
    } catch (error) {
      this.logger.warn(
        { cacheKey, error: error instanceof Error ? error.message : String(error), operation: 'cache_error' },
        'Error getting loan from cache',
      );
      return null;
    }
  }

  /**
   * Cache loan by ID
   */
  async setLoan(
    id: string,
    loan: LoanResponseDto,
    ttl?: number,
  ): Promise<void> {
    const cacheKey = this.getLoanKey(id);
    try {
      await this.redisService.setJson(cacheKey, loan, ttl || this.defaultTtl);
      this.logger.debug(
        { cacheKey, ttl: ttl || this.defaultTtl, operation: 'cache_set' },
        'Cache set',
      );
    } catch (error) {
      this.logger.warn(
        { cacheKey, error: error instanceof Error ? error.message : String(error), operation: 'cache_error' },
        'Error setting loan in cache',
      );
    }
  }

  /**
   * Get cached loan list
   */
  async getLoanList(
    query?: LoanQueryDto,
  ): Promise<PaginatedResponseDto<LoanResponseDto> | null> {
    const cacheKey = this.getLoanListKey(query);
    try {
      const cached = await this.redisService.getJson<
        PaginatedResponseDto<LoanResponseDto>
      >(cacheKey);
      if (cached) {
        this.logger.debug({ cacheKey, operation: 'cache_hit' }, 'Cache hit');
        return cached;
      }
      this.logger.debug({ cacheKey, operation: 'cache_miss' }, 'Cache miss');
      return null;
    } catch (error) {
      this.logger.warn(
        { cacheKey, error: error instanceof Error ? error.message : String(error), operation: 'cache_error' },
        'Error getting loan list from cache',
      );
      return null;
    }
  }

  /**
   * Cache loan list
   */
  async setLoanList(
    query: LoanQueryDto | undefined,
    data: PaginatedResponseDto<LoanResponseDto>,
    ttl?: number,
  ): Promise<void> {
    const cacheKey = this.getLoanListKey(query);
    try {
      await this.redisService.setJson(cacheKey, data, ttl || this.defaultTtl);
      this.logger.debug(
        { cacheKey, ttl: ttl || this.defaultTtl, operation: 'cache_set' },
        'Cache set',
      );
    } catch (error) {
      this.logger.warn(
        { cacheKey, error: error instanceof Error ? error.message : String(error), operation: 'cache_error' },
        'Error setting loan list in cache',
      );
    }
  }

  /**
   * Get cached loan stats
   */
  async getLoanStats(): Promise<LoanStatsDto | null> {
    const cacheKey = this.getLoanStatsKey();
    try {
      const cached = await this.redisService.getJson<LoanStatsDto>(cacheKey);
      if (cached) {
        this.logger.debug({ cacheKey, operation: 'cache_hit' }, 'Cache hit');
        return cached;
      }
      this.logger.debug({ cacheKey, operation: 'cache_miss' }, 'Cache miss');
      return null;
    } catch (error) {
      this.logger.warn(
        { cacheKey, error: error instanceof Error ? error.message : String(error), operation: 'cache_error' },
        'Error getting loan stats from cache',
      );
      return null;
    }
  }

  /**
   * Cache loan stats
   */
  async setLoanStats(stats: LoanStatsDto, ttl?: number): Promise<void> {
    const cacheKey = this.getLoanStatsKey();
    try {
      await this.redisService.setJson(cacheKey, stats, ttl || this.defaultTtl);
      this.logger.debug(
        { cacheKey, ttl: ttl || this.defaultTtl, operation: 'cache_set' },
        'Cache set',
      );
    } catch (error) {
      this.logger.warn(
        { cacheKey, error: error instanceof Error ? error.message : String(error), operation: 'cache_error' },
        'Error setting loan stats in cache',
      );
    }
  }

  /**
   * Invalidate single loan cache
   */
  async invalidateLoan(id: string): Promise<void> {
    const cacheKey = this.getLoanKey(id);
    try {
      await this.redisService.del(cacheKey);
      this.logger.debug(
        { cacheKey, operation: 'cache_invalidate' },
        'Cache invalidated',
      );
    } catch (error) {
      this.logger.warn(
        { cacheKey, error: error instanceof Error ? error.message : String(error), operation: 'cache_error' },
        'Error invalidating loan cache',
      );
    }
  }

  /**
   * Invalidate all loan list caches
   */
  async invalidateLoanList(): Promise<void> {
    const pattern = `${this.cachePrefix}list:*`;
    try {
      await this.redisService.delPattern(pattern);
      this.logger.debug(
        { pattern, operation: 'cache_invalidate' },
        'Cache invalidated',
      );
    } catch (error) {
      this.logger.warn(
        { pattern, error: error instanceof Error ? error.message : String(error), operation: 'cache_error' },
        'Error invalidating loan list cache',
      );
    }
  }

  /**
   * Invalidate loan stats cache
   */
  async invalidateLoanStats(): Promise<void> {
    const cacheKey = this.getLoanStatsKey();
    try {
      await this.redisService.del(cacheKey);
      this.logger.debug(
        { cacheKey, operation: 'cache_invalidate' },
        'Cache invalidated',
      );
    } catch (error) {
      this.logger.warn(
        { cacheKey, error: error instanceof Error ? error.message : String(error), operation: 'cache_error' },
        'Error invalidating loan stats cache',
      );
    }
  }

  /**
   * Invalidate all loan-related caches
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
        { pattern, error: error instanceof Error ? error.message : String(error), operation: 'cache_error' },
        'Error invalidating all loan caches',
      );
    }
  }
}

