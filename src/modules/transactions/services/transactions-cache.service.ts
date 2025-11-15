import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import { RedisService } from '../../../common/redis/redis.service';
import { RedisConfig } from '../../../config/redis.config';
import { TransactionQueryDto } from '../dto/transaction-query.dto';
import { TransactionResponseDto, TransactionStatsDto } from '../dto/transaction-response.dto';
import { Transaction } from '../../../entities/transaction.entity';
import { PaginatedResponseDto } from '../../users/dto/paginated-response.dto';
import * as crypto from 'crypto';

@Injectable()
export class TransactionsCacheService {
  private readonly defaultTtl: number;
  private readonly cachePrefix = 'transactions:';

  constructor(
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
    private readonly logger: Logger,
  ) {
    const redisConfig = this.configService.get<RedisConfig>('redis');
    this.defaultTtl = redisConfig?.ttl || 3600;
  }

  /**
   * Generate cache key for a single transaction
   */
  private getTransactionKey(id: string): string {
    return `${this.cachePrefix}${id}`;
  }

  /**
   * Generate cache key for transaction list based on query parameters
   */
  private getTransactionListKey(query?: TransactionQueryDto): string {
    if (!query || Object.keys(query).length === 0) {
      return `${this.cachePrefix}list:default`;
    }

    // Create a normalized query object for consistent hashing
    const normalizedQuery = {
      search: query.search || null,
      type: query.type || null,
      status: query.status || null,
      paymentMethod: query.paymentMethod || null,
      network: query.network || null,
      dateFrom: query.dateFrom || null,
      dateTo: query.dateTo || null,
      amountMin: query.amountMin || null,
      amountMax: query.amountMax || null,
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
   * Generate cache key for transaction stats
   */
  private getTransactionStatsKey(): string {
    return `${this.cachePrefix}stats`;
  }

  /**
   * Get cached transaction by ID
   */
  async getTransaction(id: string): Promise<Transaction | null> {
    const cacheKey = this.getTransactionKey(id);
    try {
      const cached = await this.redisService.getJson<Transaction>(cacheKey);
      if (cached) {
        this.logger.debug({ cacheKey, operation: 'cache_hit' }, 'Cache hit');
        return cached;
      }
      this.logger.debug({ cacheKey, operation: 'cache_miss' }, 'Cache miss');
      return null;
    } catch (error) {
      this.logger.warn(
        { cacheKey, error: error instanceof Error ? error.message : String(error), operation: 'cache_error' },
        'Error getting transaction from cache',
      );
      return null;
    }
  }

  /**
   * Cache transaction by ID
   */
  async setTransaction(
    id: string,
    transaction: Transaction,
    ttl?: number,
  ): Promise<void> {
    const cacheKey = this.getTransactionKey(id);
    try {
      await this.redisService.setJson(cacheKey, transaction, ttl || this.defaultTtl);
      this.logger.debug(
        { cacheKey, ttl: ttl || this.defaultTtl, operation: 'cache_set' },
        'Cache set',
      );
    } catch (error) {
      this.logger.warn(
        { cacheKey, error: error instanceof Error ? error.message : String(error), operation: 'cache_error' },
        'Error setting transaction in cache',
      );
    }
  }

  /**
   * Get cached transaction list
   */
  async getTransactionList(
    query?: TransactionQueryDto,
  ): Promise<PaginatedResponseDto<TransactionResponseDto> | null> {
    const cacheKey = this.getTransactionListKey(query);
    try {
      const cached = await this.redisService.getJson<PaginatedResponseDto<TransactionResponseDto>>(cacheKey);
      if (cached) {
        this.logger.debug({ cacheKey, operation: 'cache_hit' }, 'Cache hit');
        return cached;
      }
      this.logger.debug({ cacheKey, operation: 'cache_miss' }, 'Cache miss');
      return null;
    } catch (error) {
      this.logger.warn(
        { cacheKey, error: error instanceof Error ? error.message : String(error), operation: 'cache_error' },
        'Error getting transaction list from cache',
      );
      return null;
    }
  }

  /**
   * Cache transaction list
   */
  async setTransactionList(
    query: TransactionQueryDto | undefined,
    data: PaginatedResponseDto<TransactionResponseDto>,
    ttl?: number,
  ): Promise<void> {
    const cacheKey = this.getTransactionListKey(query);
    try {
      await this.redisService.setJson(cacheKey, data, ttl || this.defaultTtl);
      this.logger.debug(
        { cacheKey, ttl: ttl || this.defaultTtl, operation: 'cache_set' },
        'Cache set',
      );
    } catch (error) {
      this.logger.warn(
        { cacheKey, error: error instanceof Error ? error.message : String(error), operation: 'cache_error' },
        'Error setting transaction list in cache',
      );
    }
  }

  /**
   * Get cached transaction stats
   */
  async getTransactionStats(): Promise<TransactionStatsDto | null> {
    const cacheKey = this.getTransactionStatsKey();
    try {
      const cached = await this.redisService.getJson<TransactionStatsDto>(cacheKey);
      if (cached) {
        this.logger.debug({ cacheKey, operation: 'cache_hit' }, 'Cache hit');
        return cached;
      }
      this.logger.debug({ cacheKey, operation: 'cache_miss' }, 'Cache miss');
      return null;
    } catch (error) {
      this.logger.warn(
        { cacheKey, error: error instanceof Error ? error.message : String(error), operation: 'cache_error' },
        'Error getting transaction stats from cache',
      );
      return null;
    }
  }

  /**
   * Cache transaction stats
   */
  async setTransactionStats(stats: TransactionStatsDto, ttl?: number): Promise<void> {
    const cacheKey = this.getTransactionStatsKey();
    try {
      await this.redisService.setJson(cacheKey, stats, ttl || this.defaultTtl);
      this.logger.debug(
        { cacheKey, ttl: ttl || this.defaultTtl, operation: 'cache_set' },
        'Cache set',
      );
    } catch (error) {
      this.logger.warn(
        { cacheKey, error: error instanceof Error ? error.message : String(error), operation: 'cache_error' },
        'Error setting transaction stats in cache',
      );
    }
  }

  /**
   * Invalidate single transaction cache
   */
  async invalidateTransaction(id: string): Promise<void> {
    const cacheKey = this.getTransactionKey(id);
    try {
      await this.redisService.del(cacheKey);
      this.logger.debug(
        { cacheKey, operation: 'cache_invalidate' },
        'Cache invalidated',
      );
    } catch (error) {
      this.logger.warn(
        { cacheKey, error: error instanceof Error ? error.message : String(error), operation: 'cache_error' },
        'Error invalidating transaction cache',
      );
    }
  }

  /**
   * Invalidate all transaction list caches
   */
  async invalidateTransactionList(): Promise<void> {
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
        'Error invalidating transaction list cache',
      );
    }
  }

  /**
   * Invalidate transaction stats cache
   */
  async invalidateTransactionStats(): Promise<void> {
    const cacheKey = this.getTransactionStatsKey();
    try {
      await this.redisService.del(cacheKey);
      this.logger.debug(
        { cacheKey, operation: 'cache_invalidate' },
        'Cache invalidated',
      );
    } catch (error) {
      this.logger.warn(
        { cacheKey, error: error instanceof Error ? error.message : String(error), operation: 'cache_error' },
        'Error invalidating transaction stats cache',
      );
    }
  }

  /**
   * Invalidate all transaction-related caches
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
        'Error invalidating all transaction caches',
      );
    }
  }
}

