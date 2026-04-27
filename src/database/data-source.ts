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

// ---------------------------------------------------------------------------
// CSDP named data-source options
// Falls back to the same default DB env vars when CSDP-specific vars are absent
// so local development works without a pgbouncer setup.
// ---------------------------------------------------------------------------

const csdpHotUrl = process.env.DATABASE_HOT_URL;
const csdpBatchUrl = process.env.DATABASE_BATCH_URL;
const directUrl = process.env.DATABASE_DIRECT_URL;

export const csdpHotDataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  ...(csdpHotUrl
    ? { url: csdpHotUrl }
    : {
        host: process.env.CSDP_HOT_DB_HOST || process.env.DB_HOST || 'localhost',
        port: parseInt(
          process.env.CSDP_HOT_DB_PORT || process.env.DB_PORT || '5432',
          10,
        ),
        username:
          process.env.CSDP_HOT_DB_USERNAME ||
          process.env.DB_USERNAME ||
          'postgres',
        password:
          process.env.CSDP_HOT_DB_PASSWORD ||
          process.env.DB_PASSWORD ||
          'postgres',
        database:
          process.env.CSDP_HOT_DB_NAME || process.env.DB_NAME || 'rim_db',
      }),
  entities: [],
  synchronize: false,
  logging: isDevelopment,
  extra: {
    max: parseInt(process.env.CSDP_HOT_POOL_MAX ?? '20', 10),
    idleTimeoutMillis: 10000,
    statement_cache_size: 0,
  },
};

export const csdpBatchDataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  ...(csdpBatchUrl
    ? { url: csdpBatchUrl }
    : {
        host:
          process.env.CSDP_BATCH_DB_HOST ||
          process.env.DB_HOST ||
          'localhost',
        port: parseInt(
          process.env.CSDP_BATCH_DB_PORT || process.env.DB_PORT || '5432',
          10,
        ),
        username:
          process.env.CSDP_BATCH_DB_USERNAME ||
          process.env.DB_USERNAME ||
          'postgres',
        password:
          process.env.CSDP_BATCH_DB_PASSWORD ||
          process.env.DB_PASSWORD ||
          'postgres',
        database:
          process.env.CSDP_BATCH_DB_NAME || process.env.DB_NAME || 'rim_db',
      }),
  entities: [],
  synchronize: false,
  logging: isDevelopment,
  extra: {
    max: parseInt(process.env.CSDP_BATCH_POOL_MAX ?? '3', 10),
    idleTimeoutMillis: 10000,
    statement_cache_size: 0,
  },
};

/** Uses DATABASE_DIRECT_URL (bypasses pgbouncer) or falls back to default. */
export const migrationsDataSourceOptions: DataSourceOptions = {
  ...(directUrl
    ? ({
        type: 'postgres',
        url: directUrl,
      } as DataSourceOptions)
    : dataSourceOptions),
  entities: [
    join(__dirname, '..', 'entities', '**', `*.entity${entityExtension}`),
  ],
  migrations: [join(__dirname, 'migrations', '**', `*${migrationExtension}`)],
  synchronize: false,
};

export const csdpHotDataSource = new DataSource(csdpHotDataSourceOptions);
export const csdpBatchDataSource = new DataSource(csdpBatchDataSourceOptions);
export const migrationsDataSource = new DataSource(migrationsDataSourceOptions);
