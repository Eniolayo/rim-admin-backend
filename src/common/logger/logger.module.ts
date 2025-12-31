import { Module } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { ConfigModule, ConfigType, ConfigService } from '@nestjs/config';
import appConfig from '../../config/app.config';
import { LogSigningService } from '../services/log-signing.service';
import { createSignedLogDestination } from './signed-log-destination';

@Module({
  imports: [
    PinoLoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [appConfig.KEY, ConfigService],
      useFactory: (
        config: ConfigType<typeof appConfig>,
        configService: ConfigService,
      ) => {
        const logLevel = config.nodeEnv === 'production' ? 'info' : 'debug';
        
        // Create LogSigningService instance directly to avoid circular dependency
        const logSigningService = new LogSigningService(configService);
        const signingKey = logSigningService.getSigningKey();
        const isProduction = config.nodeEnv === 'production';
        
        const pinoConfig: any = {
          level: logLevel,
          serializers: {
            req: (req: any) => ({
              id: req.id,
              method: req.method,
              url: req.url,
            }),
            res: (res: any) => ({
              statusCode: res.statusCode,
            }),
            err: (err: any) => ({
              type: err.type,
              message: err.message,
              stack: err.stack,
            }),
          },
        };

        // Always use signed log destination (both dev and prod)
        // In development, it also pretty-prints to console
        pinoConfig.destination = createSignedLogDestination(
          signingKey,
          process.env.LOG_FILE_PATH || './logs/app.log',
          !isProduction, // Pretty print in development
        );

        return {
          pinoHttp: pinoConfig,
          // Ensure base logger level is also set
          level: logLevel,
        };
      },
    }),
  ],
  providers: [LogSigningService],
  exports: [LogSigningService],
})
export class LoggerModule {}
