import { DataSource, DataSourceOptions, Logger } from 'typeorm';
import { config } from 'dotenv';
import { join } from 'path';

config();

// Determine file extension based on environment
// If running with ts-node (seeds/migrations), use .ts, otherwise use .js for compiled code
// Check if we're running via ts-node by checking:
// 1. If __filename ends with .ts (running as source)
// 2. If process.argv[1] ends with .ts (main entry point is .ts)
// 3. If require.extensions['.ts'] exists (ts-node is registered)
const isRunningWithTsNode =
  (typeof __filename !== 'undefined' && __filename.endsWith('.ts')) ||
  (typeof process !== 'undefined' &&
    process.argv[1] &&
    process.argv[1].endsWith('.ts')) ||
  (typeof require !== 'undefined' &&
    require.extensions &&
    require.extensions['.ts'] !== undefined);
const isDevelopment =
  process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
const entityExtension = isDevelopment || isRunningWithTsNode ? '.ts' : '.js';
const migrationExtension = isDevelopment || isRunningWithTsNode ? '.ts' : '.js';

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
  entities: [
    join(__dirname, '..', 'entities', '**', `*.entity${entityExtension}`),
  ],
  migrations: [join(__dirname, 'migrations', '**', `*${migrationExtension}`)],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
  logger: process.env.NODE_ENV === 'test' ? new TestAwareLogger() : undefined,
};

const dataSource = new DataSource(dataSourceOptions);

export default dataSource;
