import { DataSource, DataSourceOptions } from 'typeorm';
import { config } from 'dotenv';
import { join } from 'path';

config();

function parseDatabaseUrl(url: string): Partial<DataSourceOptions> {
  try {
    const parsed = new URL(url);

    return {
      host: parsed.hostname,
      port: parseInt(parsed.port || '5432', 10),
      username: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
      database: parsed.pathname.slice(1),
    };
  } catch (error) {
    throw new Error(`Invalid DATABASE_URL format: ${error.message}`);
  }
}

function getDataSourceOptions(): DataSourceOptions {
  const baseOptions: Partial<DataSourceOptions> = {
    type: 'postgres',
    entities: [join(__dirname, '..', 'entities', '**', '*.entity.ts')],
    migrations: [join(__dirname, 'migrations', '**', '*.ts')],
    synchronize: false,
    logging: process.env.NODE_ENV === 'development',
  };

  // If DATABASE_URL is provided, parse it
  if (process.env.DATABASE_URL) {
    return {
      ...baseOptions,
      ...parseDatabaseUrl(process.env.DATABASE_URL),
    } as DataSourceOptions;
  }

  // Otherwise, use individual environment variables
  return {
    ...baseOptions,
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'rim_db',
  } as DataSourceOptions;
}

export const dataSourceOptions: DataSourceOptions = getDataSourceOptions();

const dataSource = new DataSource(dataSourceOptions);

export default dataSource;
