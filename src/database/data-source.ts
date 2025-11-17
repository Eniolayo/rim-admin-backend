import { DataSource, DataSourceOptions, Logger } from 'typeorm';
import { config } from 'dotenv';
import { join } from 'path';

config();

// Determine file extension based on environment
const isDevelopment = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test'
const entityExtension = isDevelopment ? '.ts' : '.js'
const migrationExtension = isDevelopment ? '.ts' : '.js'

// Custom logger that respects test environment
class TestAwareLogger implements Logger {
  logQuery(query: string, parameters?: any[]) {
    if (process.env.NODE_ENV === 'test') return;
    console.log('Query:', query, parameters);
  }

  logQueryError(error: string, query: string, parameters?: any[]) {
    if (process.env.NODE_ENV === 'test') return;
    console.error('Query Error:', error, query, parameters);
  }

  logQuerySlow(time: number, query: string, parameters?: any[]) {
    if (process.env.NODE_ENV === 'test') return;
    console.warn('Slow Query:', time, query, parameters);
  }

  logSchemaBuild(message: string) {
    if (process.env.NODE_ENV === 'test') return;
    console.log('Schema Build:', message);
  }

  logMigration(message: string) {
    if (process.env.NODE_ENV === 'test') return;
    console.log('Migration:', message);
  }

  log(level: 'log' | 'info' | 'warn', message: string) {
    if (process.env.NODE_ENV === 'test') return;
    console.log(`[${level}]`, message);
  }
}

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'rim_db',
  entities: [join(__dirname, '..', 'entities', '**', `*.entity${entityExtension}`)],
  migrations: [join(__dirname, 'migrations', '**', `*${migrationExtension}`)],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
  logger: process.env.NODE_ENV === 'test' ? new TestAwareLogger() : undefined,
};

const dataSource = new DataSource(dataSourceOptions);

export default dataSource;

