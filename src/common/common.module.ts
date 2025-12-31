import { Global, Module } from '@nestjs/common';
import { MetricsService } from './services/metrics.service';
import { PerformanceInterceptor } from './interceptors/performance.interceptor';
import { RedisModule } from './redis/redis.module';

@Global()
@Module({
  imports: [RedisModule],
  providers: [MetricsService, PerformanceInterceptor],
  exports: [MetricsService, PerformanceInterceptor],
})
export class CommonModule {}




