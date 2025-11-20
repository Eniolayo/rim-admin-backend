import { registerAs } from '@nestjs/config';

export interface EmailConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
  fromName: string;
}

export default registerAs(
  'email',
  (): EmailConfig => ({
    host: process.env.EMAIL_HOST || 'smtp.zeptomail.com',
    port: parseInt(process.env.EMAIL_PORT || '587', 10),
    user: process.env.EMAIL_USER || 'emailapikey',
    pass: process.env.EMAIL_PASS || '',
    from: process.env.EMAIL_FROM || 'noreply@rim.ng',
    fromName: process.env.EMAIL_FROM_NAME || 'RIM Team',
  }),
);
