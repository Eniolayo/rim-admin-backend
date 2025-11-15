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
  // Load test environment file FIRST - this has all required variables
  dotenvConfig({ path: resolve(__dirname, '../../.env.test') })
  
  // Set NODE_ENV to test if not already set
  process.env.NODE_ENV = process.env.NODE_ENV || 'test'

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
