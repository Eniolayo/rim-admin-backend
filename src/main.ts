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

  // Log request origin for debugging (before CORS to catch all requests)
  // logger.log() maps to pino's 'info' level, which is included in production logs
  app.use((req, res, next) => {
    const origin = req.headers.origin || 'no-origin';
    const method = req.method;
    const path = req.path;
    const apiToken = req.headers['x-api-token'];
    const hasApiToken = !!apiToken;
    const apiTokenLength = apiToken ? String(apiToken).length : 0;
    logger.log(
      `Request received - origin: ${origin}, method: ${method}, path: ${path}, hasApiToken: ${hasApiToken}, apiTokenLength: ${apiTokenLength}`,
    );
    next();
  });

  // CORS configuration - must be before global prefix
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim())
    : [
        'https://rim-admin-frontend.onrender.com',
        'https://rim-admin.vercel.app',
        'http://localhost:5173',
        'http://localhost:3000',
        'http://localhost:5174',
      ];

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-api-token',
      'x-skip-auth-redirect',
      'x-skip-error-toast',
      'Accept',
    ],
    exposedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400, // 24 hours
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  // Global prefix
  app.setGlobalPrefix(apiPrefix);

  const port = configService.get<number>('app.port', 3000);

  // Swagger documentation
  const enableSwagger = configService.get<boolean>('app.enableSwagger', false);
  if (enableSwagger) {
    const swaggerUsername = configService.get<string>('app.swaggerUsername');
    const swaggerPassword = configService.get<string>('app.swaggerPassword');

    // Add HTTP Basic Authentication for Swagger if credentials are configured
    // This must be added BEFORE SwaggerModule.setup() to intercept requests
    if (swaggerUsername && swaggerPassword) {
      const swaggerBasePath = `/${apiPrefix}/docs`;

      logger.log(
        `Swagger password protection enabled for path: ${swaggerBasePath}`,
      );

      app.use((req, res, next) => {
        // Check if this is a Swagger-related request
        const isSwaggerPath =
          req.path.startsWith(swaggerBasePath) ||
          req.path === `/${apiPrefix}/docs-json` ||
          req.path.startsWith(`${swaggerBasePath}/`);

        if (isSwaggerPath) {
          logger.log(`Swagger auth check for path: ${req.path}`);
          const authHeader = req.headers.authorization;

          if (!authHeader || !authHeader.startsWith('Basic ')) {
            res.setHeader(
              'WWW-Authenticate',
              'Basic realm="Swagger Documentation"',
            );
            return res.status(401).send('Unauthorized');
          }

          // Decode Basic Auth credentials
          try {
            const base64Credentials = authHeader.split(' ')[1];
            const credentials = Buffer.from(
              base64Credentials,
              'base64',
            ).toString('utf-8');
            const [username, password] = credentials.split(':');

            if (username !== swaggerUsername || password !== swaggerPassword) {
              res.setHeader(
                'WWW-Authenticate',
                'Basic realm="Swagger Documentation"',
              );
              return res.status(401).send('Unauthorized');
            }
          } catch (error) {
            res.setHeader(
              'WWW-Authenticate',
              'Basic realm="Swagger Documentation"',
            );
            return res.status(401).send('Unauthorized');
          }
        }
        next();
      });
    }

    const config = new DocumentBuilder()
      .setTitle('RIM Admin API')
      .setDescription('RIM Admin Backend API Documentation')
      .setVersion('1.0')
      .addTag(
        'api-keys',
        'API Keys - [Design Documentation](/api/admin-api-key-design.html)',
      )
      .addTag(
        'ussd-loans',
        'USSD Loans - [Design Documentation](/api/ussd-loans-design.html)',
      )
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup(`${apiPrefix}/docs`, app, document);

    const authInfo =
      swaggerUsername && swaggerPassword
        ? ' (Protected with HTTP Basic Auth)'
        : ' (No password protection - set SWAGGER_USERNAME and SWAGGER_PASSWORD to enable)';

    logger.log(
      `Swagger documentation: http://localhost:${port}/${apiPrefix}/docs${authInfo}`,
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
