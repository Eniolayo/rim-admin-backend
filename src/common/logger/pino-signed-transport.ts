/**
 * Pino Transport for Signed Logs
 * 
 * This file should be used as a Pino transport target:
 * transport: {
 *   target: './src/common/logger/pino-signed-transport.ts',
 *   options: { signingKey: 'your-key' }
 * }
 */

import * as crypto from 'crypto';
import { Transform } from 'stream';
import * as fs from 'fs';
import * as path from 'path';

interface SignedTransportOptions {
  signingKey: string;
  destination?: string;
}

export default async function (options: SignedTransportOptions) {
  const { signingKey, destination } = options;

  if (!signingKey) {
    throw new Error('signingKey is required for signed log transport');
  }

  const logPath = destination || process.env.LOG_FILE_PATH || './logs/app.log';
  const logDir = path.dirname(logPath);

  // Ensure log directory exists
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  // Create write stream
  const writeStream = fs.createWriteStream(logPath, { flags: 'a' });

  // Create transform stream that signs logs
  const transformStream = new Transform({
    objectMode: true,
    transform(chunk: any, encoding: string, callback: Function) {
      try {
        // Parse the log line
        let logData: any;
        if (typeof chunk === 'string') {
          logData = JSON.parse(chunk);
        } else if (Buffer.isBuffer(chunk)) {
          logData = JSON.parse(chunk.toString());
        } else {
          logData = chunk;
        }

        // Remove existing signature if present
        const { signature: existingSignature, signedAt, ...cleanLogData } = logData;

        // Create deterministic string for signing (sort keys)
        const sortedKeys = Object.keys(cleanLogData).sort();
        const sortedData: Record<string, any> = {};
        for (const key of sortedKeys) {
          sortedData[key] = cleanLogData[key];
        }

        const logString = JSON.stringify(sortedData);

        // Generate HMAC-SHA256 signature
        const signature = crypto
          .createHmac('sha256', signingKey)
          .update(logString)
          .digest('hex');

        // Create signed log entry
        const signedLog = {
          ...cleanLogData,
          signature,
          signedAt: new Date().toISOString(),
        };

        // Write signed log as JSON line
        const signedLogLine = JSON.stringify(signedLog) + '\n';
        this.push(signedLogLine);
        callback();
      } catch (error) {
        // If signing fails, write original chunk
        const originalLine = typeof chunk === 'string' 
          ? chunk 
          : Buffer.isBuffer(chunk) 
            ? chunk.toString() 
            : JSON.stringify(chunk);
        this.push(originalLine + '\n');
        callback();
      }
    },
  });

  // Pipe transform to write stream
  transformStream.pipe(writeStream);

  return transformStream;
}




