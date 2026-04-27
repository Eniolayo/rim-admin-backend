import { registerAs } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export interface CsdpConnectionConfig {
  url?: string;
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  poolMax: number;
  idleTimeoutMs: number;
}

export interface CsdpDatabaseConfig {
  hot: CsdpConnectionConfig;
  batch: CsdpConnectionConfig;
  direct: CsdpConnectionConfig;
}

/**
 * Build TypeOrmModuleOptions-compatible object for a CSDP connection.
 * Uses url if present, otherwise individual fields. Sets extra pool options
 * that are safe for transaction-pool-mode pgbouncer (statement_cache_size: 0).
 */
export function buildTypeOrmOptions(
  cfg: CsdpConnectionConfig,
  entities: Function[],
): TypeOrmModuleOptions {
  const base: TypeOrmModuleOptions = {
    type: 'postgres',
    entities,
    synchronize: false,
    logging: process.env.NODE_ENV === 'development',
    extra: {
      max: cfg.poolMax,
      idleTimeoutMillis: cfg.idleTimeoutMs,
      statement_cache_size: 0,
    },
  };

  if (cfg.url) {
    return { ...base, url: cfg.url };
  }

  return {
    ...base,
    host: cfg.host,
    port: cfg.port,
    username: cfg.username,
    password: cfg.password,
    database: cfg.database,
  };
}

export default registerAs('csdpDatabase', (): CsdpDatabaseConfig => {
  const hotPoolMax = parseInt(process.env.CSDP_HOT_POOL_MAX ?? '20', 10);
  const batchPoolMax = parseInt(process.env.CSDP_BATCH_POOL_MAX ?? '3', 10);
  const idleTimeoutMs = parseInt(
    process.env.CSDP_DB_IDLE_TIMEOUT_MS ?? '10000',
    10,
  );

  // Fallback host/port/user/pass/db from default DB envs so dev still works
  const defaultHost = process.env.DB_HOST || 'localhost';
  const defaultPort = parseInt(process.env.DB_PORT || '5432', 10);
  const defaultUsername = process.env.DB_USERNAME || 'postgres';
  const defaultPassword = process.env.DB_PASSWORD || 'postgres';
  const defaultDatabase = process.env.DB_NAME || 'rim_db';

  const hot: CsdpConnectionConfig = {
    url: process.env.DATABASE_HOT_URL,
    host: process.env.CSDP_HOT_DB_HOST || defaultHost,
    port: parseInt(process.env.CSDP_HOT_DB_PORT || String(defaultPort), 10),
    username: process.env.CSDP_HOT_DB_USERNAME || defaultUsername,
    password: process.env.CSDP_HOT_DB_PASSWORD || defaultPassword,
    database: process.env.CSDP_HOT_DB_NAME || defaultDatabase,
    poolMax: hotPoolMax,
    idleTimeoutMs,
  };

  const batch: CsdpConnectionConfig = {
    url: process.env.DATABASE_BATCH_URL,
    host: process.env.CSDP_BATCH_DB_HOST || defaultHost,
    port: parseInt(process.env.CSDP_BATCH_DB_PORT || String(defaultPort), 10),
    username: process.env.CSDP_BATCH_DB_USERNAME || defaultUsername,
    password: process.env.CSDP_BATCH_DB_PASSWORD || defaultPassword,
    database: process.env.CSDP_BATCH_DB_NAME || defaultDatabase,
    poolMax: batchPoolMax,
    idleTimeoutMs,
  };

  // direct uses DATABASE_DIRECT_URL if set; individual fields fall back to
  // the same defaults (mirrors the default DB connection, bypasses pgbouncer)
  const direct: CsdpConnectionConfig = {
    url: process.env.DATABASE_DIRECT_URL,
    host: defaultHost,
    port: defaultPort,
    username: defaultUsername,
    password: defaultPassword,
    database: defaultDatabase,
    poolMax: 1, // direct/migrations: single connection
    idleTimeoutMs,
  };

  return { hot, batch, direct };
});
