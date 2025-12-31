import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Optional,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Logger } from 'nestjs-pino';
import { MetricsService } from '../services/metrics.service';

@Injectable()
export class PerformanceInterceptor implements NestInterceptor {
  private readonly slowRequestThreshold: number = 200; // milliseconds

  constructor(
    private readonly metricsService: MetricsService,
    private readonly logger: Logger,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const start = Date.now();
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const { method, url, path } = request;

    // Skip health checks and metrics endpoints
    if (path === '/health' || path === '/metrics' || path === '/api/docs') {
      return next.handle();
    }

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - start;
        const statusCode = response.statusCode;

        // Record metrics
        this.metricsService
          .recordLatency(method, url, duration, statusCode)
          .catch((error) => {
            // Don't fail request if metrics fail
            this.logger.warn(
              { error: error.message },
              'Error recording metrics',
            );
          });

        // Log slow requests
        if (duration > this.slowRequestThreshold) {
          this.logger.warn(
            {
              method,
              url,
              path,
              duration,
              statusCode,
              threshold: this.slowRequestThreshold,
            },
            'Slow request detected',
          );

          // Log slow request event (can be extended with EventEmitter if needed)
          this.logger.warn(
            {
              event: 'slow-request',
              method,
              url,
              path,
              duration,
              statusCode,
              timestamp: new Date().toISOString(),
            },
            'Slow request event',
          );
        } else {
          // Debug log for all requests in development
          if (process.env.NODE_ENV === 'development') {
            this.logger.debug(
              {
                method,
                url,
                duration,
                statusCode,
              },
              'Request completed',
            );
          }
        }
      }),
      catchError((error) => {
        const duration = Date.now() - start;
        const statusCode = error.status || 500;

        // Record error metrics
        this.metricsService.recordError(method, url, duration, statusCode);

        // Log error with performance context
        this.logger.error(
          {
            method,
            url,
            path,
            duration,
            statusCode,
            error: error.message,
            stack: error.stack,
          },
          'Request failed',
        );

        throw error;
      }),
    );
  }
}

