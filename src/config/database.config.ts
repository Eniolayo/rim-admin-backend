import { registerAs } from '@nestjs/config';

export interface DatabaseConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
}

function parseDatabaseUrl(url: string): DatabaseConfig {
  try {
    // Parse postgresql:// or postgres:// URLs
    const parsed = new URL(url);

    return {
      host: parsed.hostname,
      port: parseInt(parsed.port || '5432', 10),
      username: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
      database: parsed.pathname.slice(1), // Remove leading '/'
    };
  } catch (error) {
    throw new Error(`Invalid DATABASE_URL format: ${error.message}`);
  }
}

export default registerAs('database', (): DatabaseConfig => {
  // If DATABASE_URL is provided, parse it
  if (process.env.DATABASE_URL) {
    return parseDatabaseUrl(process.env.DATABASE_URL);
  }

  // Otherwise, use individual environment variables
  return {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'rim_db',
  };
});
