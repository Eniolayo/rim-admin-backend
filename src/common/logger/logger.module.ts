import { Module } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { ConfigModule, ConfigType } from '@nestjs/config';
import appConfig from '../../config/app.config';

@Module({
  imports: [
    PinoLoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [appConfig.KEY],
      useFactory: (config: ConfigType<typeof appConfig>) => {
        const logLevel = config.nodeEnv === 'production' ? 'info' : 'debug';
        return {
          pinoHttp: {
            level: logLevel,
            transport:
              config.nodeEnv !== 'production'
                ? {
                    target: 'pino-pretty',
                    options: {
                      singleLine: false,
                      colorize: true,
                      translateTime: 'SYS:standard',
                      ignore: 'pid,hostname',
                    },
                  }
                : undefined,
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
          },
          // Ensure base logger level is also set for production
          level: logLevel,
        };
      },
    }),
  ],
})
export class LoggerModule {}
