import * as crypto from 'crypto';
import { Transform } from 'stream';

/**
 * Custom Pino transport that adds HMAC signatures to log entries
 * 
 * Usage in logger.module.ts:
 * transport: createSignedLogTransport(signingKey)
 */
export function createSignedLogTransport(signingKey: string) {
  return {
    target: 'pino/file',
    options: {
      destination: process.env.LOG_FILE_PATH || './logs/app.log',
      mkdir: true,
    },
    transform: (log: any) => {
      // Extract signature if it exists (to avoid double-signing)
      const { signature: existingSignature, signedAt, ...logData } = log;

      // Create deterministic string for signing
      const sortedKeys = Object.keys(logData).sort();
      const sortedData: Record<string, any> = {};
      for (const key of sortedKeys) {
        sortedData[key] = logData[key];
      }

      const logString = JSON.stringify(sortedData);

      // Generate HMAC signature
      const signature = crypto
        .createHmac('sha256', signingKey)
        .update(logString)
        .digest('hex');

      // Return signed log entry
      return {
        ...logData,
        signature,
        signedAt: new Date().toISOString(),
      };
    },
  };
}

/**
 * Custom Pino transport stream that signs logs
 * This is an alternative implementation using a Transform stream
 */
export class SignedLogTransform extends Transform {
  private readonly signingKey: string;

  constructor(signingKey: string) {
    super({ objectMode: true });
    this.signingKey = signingKey;
  }

  _transform(chunk: any, encoding: string, callback: Function) {
    try {
      // Parse the log line if it's a string
      let logData: any;
      if (typeof chunk === 'string') {
        logData = JSON.parse(chunk);
      } else {
        logData = chunk;
      }

      // Extract existing signature if present
      const { signature: existingSignature, signedAt, ...cleanLogData } = logData;

      // Create deterministic string for signing
      const sortedKeys = Object.keys(cleanLogData).sort();
      const sortedData: Record<string, any> = {};
      for (const key of sortedKeys) {
        sortedData[key] = cleanLogData[key];
      }

      const logString = JSON.stringify(sortedData);

      // Generate HMAC signature
      const signature = crypto
        .createHmac('sha256', this.signingKey)
        .update(logString)
        .digest('hex');

      // Add signature to log
      const signedLog = {
        ...cleanLogData,
        signature,
        signedAt: new Date().toISOString(),
      };

      // Push the signed log
      this.push(JSON.stringify(signedLog) + '\n');
      callback();
    } catch (error) {
      // If signing fails, push original chunk
      this.push(chunk);
      callback();
    }
  }
}




