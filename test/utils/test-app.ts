import { INestApplication } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { config as dotenvConfig } from 'dotenv'
import { resolve } from 'path'
import { DataSource } from 'typeorm'

export interface TestApp {
  app: INestApplication
  httpServer: any
  dataSource?: DataSource
}

export async function initTestApp(): Promise<TestApp> {
  // Load environment files to match docker-compose.dev.yml configuration
  // 1. Load .env first (contains actual credentials from docker-compose.dev.yml)
  // 2. Load .env.test to override with test-specific values (DB_HOST=localhost, etc.)
  // Tests run on host machine, so DB_HOST and REDIS_HOST should be 'localhost'
  // (not 'postgres' or 'redis' which are container names)
  const envPath = resolve(__dirname, '../../.env')
  const envTestPath = resolve(__dirname, '../../.env.test')
  
  // Load .env (may not exist, that's okay)
  dotenvConfig({ path: envPath })
  // Load .env.test overrides
  dotenvConfig({ path: envTestPath })
  
  // Set NODE_ENV to test if not already set
  process.env.NODE_ENV = process.env.NODE_ENV || 'test'
  
  // Ensure test uses localhost for services (tests run on host, not in container)
  if (!process.env.DB_HOST || process.env.DB_HOST === 'postgres') {
    process.env.DB_HOST = 'localhost'
  }
  if (!process.env.REDIS_HOST || process.env.REDIS_HOST === 'redis') {
    process.env.REDIS_HOST = 'localhost'
  }
  
  // Set defaults from docker-compose.dev.yml if not already set
  // These match the defaults in docker-compose.dev.yml
  if (!process.env.DB_USERNAME) process.env.DB_USERNAME = 'postgres'
  if (!process.env.DB_PASSWORD) process.env.DB_PASSWORD = 'postgres'
  if (!process.env.DB_NAME) process.env.DB_NAME = 'rim_db_dev'
  if (!process.env.DB_PORT) process.env.DB_PORT = '5432'
  if (!process.env.REDIS_PORT) process.env.REDIS_PORT = '6379'
  if (!process.env.JWT_SECRET) process.env.JWT_SECRET = 'dev-jwt-secret-key-min-32-chars-long'
  if (!process.env.JWT_EXPIRATION) process.env.JWT_EXPIRATION = '12h'
  if (!process.env.JWT_REFRESH_SECRET) process.env.JWT_REFRESH_SECRET = 'dev-refresh-secret-key-min-32-chars'
  if (!process.env.JWT_REFRESH_EXPIRATION) process.env.JWT_REFRESH_EXPIRATION = '7d'

  // NOW import AppModule after test env vars are loaded
  const { AppModule } = require('../../src/app.module')
  const { runSeed: runAdminSeed } = require('../../src/database/seeds/admin.seed')

  try {
    // Create test-specific data source to avoid conflicts
    const { dataSourceOptions } = require('../../src/database/data-source')
    const testDataSource = new DataSource({
      ...dataSourceOptions,
      logging: false, // Disable logging during tests
      logger: undefined,
    })

    if (!testDataSource.isInitialized) {
      await testDataSource.initialize()
      await testDataSource.runMigrations()
    }

    await runAdminSeed(testDataSource)

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    const app = moduleFixture.createNestApplication()
    await app.init()

    return { app, httpServer: app.getHttpServer(), dataSource: testDataSource }
  } catch (error) {
    console.error('Failed to initialize test app:', error)
    throw error
  }
}

export async function closeTestApp(testApp: TestApp): Promise<void> {
  try {
    if (testApp?.app) {
      await testApp.app.close()
    }
    if (testApp?.dataSource?.isInitialized) {
      await testApp.dataSource.destroy()
    }
  } catch (error) {
    console.error('Error during test cleanup:', error)
  }
}
