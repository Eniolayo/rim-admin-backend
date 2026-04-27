import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppBatchModule } from './app.batch.module';

async function bootstrap(): Promise<void> {
  process.env.RUN_SCHEDULERS = '1';

  const app = await NestFactory.create(AppBatchModule, {
    bufferLogs: true,
  });

  const logger = app.get(Logger);
  app.useLogger(logger);

  const port = process.env.BATCH_PORT ?? '3001';

  await app.listen(Number(port));

  logger.log(`Batch process running on: http://localhost:${port}`);

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    logger.log('SIGTERM received, shutting down batch process gracefully...');
    await app.close();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    logger.log('SIGINT received, shutting down batch process gracefully...');
    await app.close();
    process.exit(0);
  });
}

bootstrap();
