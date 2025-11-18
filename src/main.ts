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
  const allowedOrigins = [
    // Localhost with any port
    /^http:\/\/localhost:\d+$/,
    // Render.com domain
    'https://rim-admin-frontend.onrender.com',
    // Additional origins from environment variable
    ...(process.env.CORS_ORIGIN?.split(',').map((origin) => origin.trim()) ||
      []),
  ];

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) {
        return callback(null, true);
      }

      // Check if origin matches any allowed origin
      const isAllowed = allowedOrigins.some((allowedOrigin) => {
        if (typeof allowedOrigin === 'string') {
          return origin === allowedOrigin;
        }
        if (allowedOrigin instanceof RegExp) {
          return allowedOrigin.test(origin);
        }
        return false;
      });

      if (isAllowed) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
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
