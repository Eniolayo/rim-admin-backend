import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import Redis from 'ioredis';
import { AppModule } from './app.module';
import appConfig from './config/app.config';
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

  // Enable CORS
  // Build list of allowed origins
  const allowedOriginStrings: string[] = [
    'https://rim-admin-frontend.onrender.com',
    ...(process.env.CORS_ORIGIN?.split(',').map((origin) => origin.trim()) ||
      []),
  ];

  // Build list of allowed origin patterns (regex)
  const allowedOriginPatterns: RegExp[] = [
    // Localhost with any port (http and https)
    /^https?:\/\/localhost:\d+$/,
    // Render.com domain (with or without trailing slash, with or without www)
    /^https:\/\/(www\.)?rim-admin-frontend\.onrender\.com\/?$/,
  ];

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) {
        logger.debug('CORS: Request with no origin, allowing');
        return callback(null, true);
      }

      // Normalize origin (remove trailing slash and whitespace)
      const normalizedOrigin = origin.trim().replace(/\/+$/, '');

      logger.debug(`CORS: Checking origin: ${normalizedOrigin}`);

      // Check exact string matches first
      const exactMatch = allowedOriginStrings.some((allowedOrigin) => {
        const normalizedAllowed = allowedOrigin.trim().replace(/\/+$/, '');
        return normalizedOrigin === normalizedAllowed;
      });

      if (exactMatch) {
        logger.debug(
          `CORS: Origin ${normalizedOrigin} is allowed (exact match)`,
        );
        return callback(null, true);
      }

      // Check pattern matches
      const patternMatch = allowedOriginPatterns.some((pattern) => {
        return pattern.test(normalizedOrigin);
      });

      if (patternMatch) {
        logger.debug(
          `CORS: Origin ${normalizedOrigin} is allowed (pattern match)`,
        );
        return callback(null, true);
      }

      // Origin not allowed
      logger.warn(`CORS: Origin ${normalizedOrigin} is not allowed`);
      logger.warn(
        `CORS: Allowed origins: ${JSON.stringify(allowedOriginStrings)}`,
      );
      callback(new Error(`Not allowed by CORS: ${normalizedOrigin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Origin',
    ],
    exposedHeaders: ['Authorization'],
    maxAge: 86400, // 24 hours
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

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
