import { registerAs } from '@nestjs/config';

export interface AppConfig {
  port: number;
  nodeEnv: string;
  apiPrefix: string;
  enableSwagger: boolean;
  swaggerUsername?: string;
  swaggerPassword?: string;
}

export default registerAs(
  'app',
  (): AppConfig => ({
    port: parseInt(process.env.PORT || '3000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    apiPrefix: process.env.API_PREFIX || 'api',
    enableSwagger: true,
    swaggerUsername: process.env.SWAGGER_USERNAME,
    swaggerPassword: process.env.SWAGGER_PASSWORD,
  }),
);
