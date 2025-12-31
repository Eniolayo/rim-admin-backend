/**
 * Custom Pino Transport that signs logs and optionally pretty-prints
 * 
 * In development: Signs logs to file AND pretty-prints to console
 * In production: Signs logs to file only
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { Transform } from 'stream';

interface SignedPrettyTransportOptions {
  signingKey: string;
  destination?: string;
  pretty?: boolean;
}

export default async function (options: SignedPrettyTransportOptions) {
  const { signingKey, destination, pretty = false } = options;

  if (!signingKey) {
    throw new Error('signingKey is required for signed log transport');
  }

  const logPath = destination || process.env.LOG_FILE_PATH || './logs/app.log';
  const logDir = path.dirname(logPath);

  // Ensure log directory exists
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  // Create write stream for file
  const writeStream = fs.createWriteStream(logPath, { flags: 'a' });

  // Import pino-pretty if needed
  let prettyPrint: any = null;
  if (pretty) {
    try {
      const pinoPretty = await import('pino-pretty');
      prettyPrint = pinoPretty.default({
        singleLine: false,
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      });
    } catch (error) {
      // pino-pretty not available, skip pretty printing
      console.warn('pino-pretty not available, skipping pretty output');
    }
  }

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

        // Write signed log to file
        const signedLogLine = JSON.stringify(signedLog) + '\n';
        writeStream.write(signedLogLine);

        // Pretty print to console if enabled
        if (pretty && prettyPrint) {
          const prettyLine = prettyPrint(JSON.stringify(cleanLogData));
          if (prettyLine) {
            process.stdout.write(prettyLine);
          }
        }

        this.push(chunk); // Pass through original for Pino
        callback();
      } catch (error) {
        // If signing fails, write original chunk
        writeStream.write(chunk);
        if (pretty && prettyPrint) {
          const prettyLine = prettyPrint(chunk.toString());
          if (prettyLine) {
            process.stdout.write(prettyLine);
          }
        }
        this.push(chunk);
        callback();
      }
    },
    flush(callback: Function) {
      writeStream.end(() => callback());
    },
  });

  return transformStream;
}




