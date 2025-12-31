import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import { Counter, Histogram } from 'prom-client';
import { RedisService } from '../redis/redis.service';

export interface LatencyMetric {
  method: string;
  endpoint: string;
  duration: number;
  statusCode: number;
  timestamp: number;
}

@Injectable()
export class MetricsService {
  private readonly httpRequestDuration: Histogram<string>;
  private readonly httpRequestTotal: Counter<string>;
  private readonly httpRequestErrors: Counter<string>;
  private readonly slowRequestCounter: Counter<string>;
  private readonly redisKeyPrefix = 'metrics:latency:';
  private readonly maxLatencyEntries = 1000;

  constructor(
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
    private readonly logger: Logger,
  ) {
    // Create Prometheus metrics (using default registry)
    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    });

    this.httpRequestTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code'],
    });

    this.httpRequestErrors = new Counter({
      name: 'http_request_errors_total',
      help: 'Total number of HTTP request errors',
      labelNames: ['method', 'route', 'status_code'],
    });

    this.slowRequestCounter = new Counter({
      name: 'http_slow_requests_total',
      help: 'Total number of slow requests (>200ms)',
      labelNames: ['method', 'route'],
    });
  }

  /**
   * Record request latency
   */
  async recordLatency(
    method: string,
    endpoint: string,
    duration: number,
    statusCode: number,
  ): Promise<void> {
    const durationSeconds = duration / 1000;
    const normalizedRoute = this.normalizeRoute(endpoint);

    // Record to Prometheus
    this.httpRequestDuration.observe(
      { method, route: normalizedRoute, status_code: statusCode.toString() },
      durationSeconds,
    );

    this.httpRequestTotal.inc({
      method,
      route: normalizedRoute,
      status_code: statusCode.toString(),
    });

    // Track slow requests (>200ms)
    if (duration > 200) {
      this.slowRequestCounter.inc({ method, route: normalizedRoute });
    }

    // Store in Redis for percentile calculations
    await this.storeLatencyInRedis(method, normalizedRoute, duration, statusCode);

    // Track errors (4xx, 5xx)
    if (statusCode >= 400) {
      this.httpRequestErrors.inc({
        method,
        route: normalizedRoute,
        status_code: statusCode.toString(),
      });
    }
  }

  /**
   * Record error
   */
  recordError(
    method: string,
    endpoint: string,
    duration: number,
    statusCode: number,
  ): void {
    const normalizedRoute = this.normalizeRoute(endpoint);
    this.httpRequestErrors.inc({
      method,
      route: normalizedRoute,
      status_code: statusCode.toString(),
    });
    this.httpRequestTotal.inc({
      method,
      route: normalizedRoute,
      status_code: statusCode.toString(),
    });
  }

  /**
   * Get latency percentiles for an endpoint
   */
  async getPercentiles(
    method: string,
    endpoint: string,
  ): Promise<{ p50: number; p95: number; p99: number } | null> {
    const normalizedRoute = this.normalizeRoute(endpoint);
    const key = `${this.redisKeyPrefix}${method}:${normalizedRoute}`;

    try {
      // Get all latency values from Redis sorted set
      const latencies = await this.redisService.zrange(key, 0, -1, 'WITHSCORES');
      
      if (latencies.length === 0) {
        return null;
      }

      // Convert to numbers and sort
      const values = latencies
        .filter((_, index) => index % 2 === 0)
        .map((val) => parseFloat(val))
        .sort((a, b) => a - b);

      const count = values.length;
      const p50 = values[Math.floor(count * 0.5)] || 0;
      const p95 = values[Math.floor(count * 0.95)] || 0;
      const p99 = values[Math.floor(count * 0.99)] || 0;

      return { p50, p95, p99 };
    } catch (error) {
      this.logger.warn(
        { error: error.message, method, endpoint },
        'Error getting percentiles from Redis',
      );
      return null;
    }
  }

  /**
   * Get aggregated metrics
   */
  async getAggregatedMetrics(): Promise<{
    totalRequests: number;
    errorRate: number;
    averageLatency: number;
    slowRequests: number;
    endpoints: Array<{
      method: string;
      route: string;
      requests: number;
      errors: number;
      percentiles: { p50: number; p95: number; p99: number } | null;
    }>;
  }> {
    // Get metrics from Prometheus default registry
    const { register } = await import('prom-client');
    const metrics = await register.getMetricsAsJSON();
    
    // Parse metrics to extract values
    let totalRequests = 0;
    let totalErrors = 0;
    let slowRequests = 0;
    
    // Extract values from Prometheus metrics JSON
    for (const metric of metrics) {
      if (metric.name === 'http_requests_total') {
        // Sum all request counts
        totalRequests = metric.values?.reduce((sum: number, val: any) => sum + (val.value || 0), 0) || 0;
      } else if (metric.name === 'http_request_errors_total') {
        // Sum all error counts
        totalErrors = metric.values?.reduce((sum: number, val: any) => sum + (val.value || 0), 0) || 0;
      } else if (metric.name === 'http_slow_requests_total') {
        // Sum all slow request counts
        slowRequests = metric.values?.reduce((sum: number, val: any) => sum + (val.value || 0), 0) || 0;
      }
    }
    
    const errorRate = totalRequests > 0 ? totalErrors / totalRequests : 0;
    
    return {
      totalRequests,
      errorRate,
      averageLatency: 0, // Would need to calculate from histogram buckets
      slowRequests,
      endpoints: [], // Would need to extract from metrics with labels
    };
  }

  /**
   * Store latency in Redis sorted set for percentile calculations
   */
  private async storeLatencyInRedis(
    method: string,
    route: string,
    duration: number,
    statusCode: number,
  ): Promise<void> {
    const key = `${this.redisKeyPrefix}${method}:${route}`;
    const timestamp = Date.now();

    try {
      // Add to sorted set with timestamp as score and duration as member
      await this.redisService.zadd(key, timestamp, duration.toString());

      // Keep only last N entries (remove oldest)
      const count = await this.redisService.zcard(key);
      if (count > this.maxLatencyEntries) {
        const removeCount = count - this.maxLatencyEntries;
        await this.redisService.zremrangebyrank(key, 0, removeCount - 1);
      }

      // Set expiration (24 hours)
      await this.redisService.expire(key, 86400);
    } catch (error) {
      // Don't fail request if metrics storage fails
      this.logger.warn(
        { error: error.message, key },
        'Error storing latency in Redis',
      );
    }
  }

  /**
   * Normalize route to remove IDs and make it consistent
   */
  private normalizeRoute(route: string): string {
    // Remove query strings
    const path = route.split('?')[0];
    
    // Replace UUIDs and IDs with placeholders
    return path
      .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
      .replace(/\/\d+/g, '/:id')
      .replace(/^\/api/, '');
  }
}

