import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import Redis from 'ioredis';
import { AppModule } from './app.module';
import { REDIS_CLIENT } from './common/redis/redis.constants';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  const configService = app.get(ConfigService);
  const logger = app.get(Logger);
  const apiPrefix = configService.get<string>('app.apiPrefix', 'api');
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');

  app.useLogger(logger);

  // CORS Configuration - MUST be before setGlobalPrefix and any guards
  // Frontend uses withCredentials: true, so we MUST specify exact origins (cannot use '*')
  // const allowedOrigins: string[] = [
  //   'https://rim-admin-frontend.onrender.com',
  //   'http://localhost:3000',
  //   'http://localhost:5173',
  //   'http://localhost:5174',
  //   'http://localhost:8080',
  //   ...(process.env.CORS_ORIGIN?.split(',').map((origin) => origin.trim()) ||
  //     []),
  // ];

  // Function to check if origin is allowed
  // const isOriginAllowed = (origin: string | undefined): boolean => {
  //   if (!origin) {
  //     return true; // Allow requests with no origin
  //   }

  //   // Check exact matches
  //   if (allowedOrigins.includes(origin)) {
  //     return true;
  //   }

  //   // Check localhost with any port
  //   if (/^https?:\/\/localhost:\d+$/.test(origin)) {
  //     return true;
  //   }

  //   return false;
  // };

  // Custom CORS middleware that runs BEFORE everything else
  // This ensures OPTIONS requests are handled before guards can interfere
  // app.use((req: any, res: any, next: any) => {
  //   const origin = req.headers.origin;

  //   // Handle preflight OPTIONS requests immediately
  //   if (req.method === 'OPTIONS') {
  //     if (isOriginAllowed(origin)) {
  //       // When credentials: true, we MUST return the exact origin (not '*')
  //       res.setHeader('Access-Control-Allow-Origin', origin || '*');
  //       res.setHeader(
  //         'Access-Control-Allow-Methods',
  //         'GET, POST, PUT, DELETE, PATCH, OPTIONS',
  //       );
  //       res.setHeader(
  //         'Access-Control-Allow-Headers',
  //         'Content-Type, Authorization, X-Requested-With, Accept, Origin',
  //       );
  //       res.setHeader('Access-Control-Allow-Credentials', 'true');
  //       res.setHeader('Access-Control-Max-Age', '86400');
  //       res.setHeader('Access-Control-Expose-Headers', 'Authorization');
  //       logger.warn(`CORS: OPTIONS preflight allowed for origin: ${origin}`);
  //       return res.status(204).end();
  //     } else {
  //       logger.warn(`CORS: OPTIONS request rejected for origin: ${origin}`);
  //       return res.status(403).end();
  //     }
  //   }

  //   // For non-OPTIONS requests, set CORS headers if origin is allowed
  //   if (isOriginAllowed(origin)) {
  //     // When credentials: true, we MUST return the exact origin (not '*')
  //     res.setHeader('Access-Control-Allow-Origin', origin || '*');
  //     res.setHeader('Access-Control-Allow-Credentials', 'true');
  //     res.setHeader('Access-Control-Expose-Headers', 'Authorization');
  //   }

  //   next();
  // });

  app.enableCors();
  // app.enableCors({
  //   origin: (origin: string | undefined) => {
  //     if (!origin) return true;
  //     if (isOriginAllowed(origin)) {
  //       logger.warn(`CORS: Allowing origin: ${origin}`);
  //       return origin;
  //     }
  //     logger.warn(`CORS: REJECTING origin: ${origin}`);
  //     return false;
  //   },
  //   credentials: true,
  //   methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  //   allowedHeaders: [
  //     'Content-Type',
  //     'Authorization',
  //     'X-Requested-With',
  //     'Accept',
  //     'Origin',
  //   ],
  //   exposedHeaders: ['Authorization'],
  //   maxAge: 86400,
  //   preflightContinue: false,
  //   optionsSuccessStatus: 204,
  // });

  // Global prefix
  app.setGlobalPrefix(apiPrefix);

  // Remove this duplicate ValidationPipe - it's already in app.module.ts
  // app.useGlobalPipes(
  //   new ValidationPipe({
  //     whitelist: true,
  //     forbidNonWhitelisted: true,
  //     transform: true,
  //     transformOptions: {
  //       enableImplicitConversion: true,
  //     },
  //   }),
  // );

  const port = configService.get<number>('app.port', 3000);

  // Swagger documentation
  const enableSwagger = configService.get<boolean>('app.enableSwagger', false);
  if (enableSwagger) {
    const config = new DocumentBuilder()
      .setTitle('RIM Admin API')
      .setDescription('RIM Admin Backend API Documentation')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup(`${apiPrefix}/docs`, app, document);
    logger.log(
      `Swagger documentation: http://localhost:${port}/${apiPrefix}/docs`,
    );
  }

  // Connect to Redis
  try {
    const redisClient = app.get<Redis>(REDIS_CLIENT);

    // Handle Redis errors
    redisClient.on('error', (err) => {
      logger.error('Redis connection error:', err);
    });

    redisClient.on('connect', () => {
      logger.log('Redis client connected');
    });

    redisClient.on('ready', () => {
      logger.log('Redis client ready');
    });

    redisClient.on('close', () => {
      logger.warn('Redis connection closed');
    });

    // Connect only if not already connected/connecting
    if (redisClient.status === 'wait' || redisClient.status === 'end') {
      await redisClient.connect();
      logger.log('Redis connected successfully');
    } else if (redisClient.status === 'ready') {
      logger.log('Redis already connected');
    } else {
      logger.log(`Redis status: ${redisClient.status}`);
    }
  } catch (error) {
    logger.error('Failed to connect to Redis:', error);
    // Continue application startup even if Redis fails
    // This allows the app to run without Redis if needed
  }

  await app.listen(port);

  logger.log(
    `Application is running on: http://localhost:${port}/${apiPrefix}`,
  );

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    logger.log('SIGTERM received, shutting down gracefully...');
    try {
      const redisClient = app.get<Redis>(REDIS_CLIENT);
      if (redisClient && redisClient.status === 'ready') {
        await redisClient.quit();
        logger.log('Redis connection closed');
      }
    } catch (error) {
      logger.error('Error closing Redis connection:', error);
    }
    await app.close();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    logger.log('SIGINT received, shutting down gracefully...');
    try {
      const redisClient = app.get<Redis>(REDIS_CLIENT);
      if (redisClient && redisClient.status === 'ready') {
        await redisClient.quit();
        logger.log('Redis connection closed');
      }
    } catch (error) {
      logger.error('Error closing Redis connection:', error);
    }
    await app.close();
    process.exit(0);
  });
}

bootstrap();
