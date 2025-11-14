import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { join } from 'path';

config();

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'rim_db',
  entities: [join(__dirname, 'src', 'entities', '**', '*.entity.ts')],
  migrations: [join(__dirname, 'src', 'database', 'migrations', '**', '*.ts')],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
});

