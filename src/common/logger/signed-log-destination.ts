import * as crypto from 'crypto';
import { Writable } from 'stream';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Creates a signed log destination stream for Pino
 * This can be used as the destination option in Pino configuration
 * Pino expects a Writable stream, not a Transform stream
 * 
 * @param signingKey - HMAC signing key
 * @param filePath - Path to log file
 * @param prettyPrint - Whether to also pretty-print to console (development)
 */
export function createSignedLogDestination(
  signingKey: string,
  filePath?: string,
  prettyPrint: boolean = false,
): Writable {
  const logPath = filePath || process.env.LOG_FILE_PATH || './logs/app.log';
  const logDir = path.dirname(logPath);

  // Ensure log directory exists
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  // Create write stream
  const writeStream = fs.createWriteStream(logPath, { flags: 'a' });

  // Lazy load pino-pretty if needed
  let prettyFormatter: any = null;
  if (prettyPrint) {
    try {
      // Dynamic import for optional dependency
      const pinoPretty = require('pino-pretty');
      prettyFormatter = pinoPretty({
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

  // Create writable stream that signs logs
  const signStream = new Writable({
    write(chunk: Buffer, encoding: string, callback: (error?: Error | null) => void) {
      try {
        // Parse the log line (Pino outputs JSON lines)
        const logLine = chunk.toString();
        if (!logLine.trim()) {
          callback();
          return;
        }

        let logData: any;
        try {
          logData = JSON.parse(logLine);
        } catch {
          // If not valid JSON, pass through as-is
          writeStream.write(chunk, (err) => {
            if (prettyPrint && prettyFormatter) {
              process.stdout.write(chunk);
            }
            callback(err);
          });
          return;
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

        // Write signed log as JSON line to file
        const signedLogLine = JSON.stringify(signedLog) + '\n';
        writeStream.write(signedLogLine, (err) => {
          // Pretty print to console if enabled (for development)
          if (prettyPrint && prettyFormatter) {
            const prettyOutput = prettyFormatter(logLine);
            if (prettyOutput) {
              process.stdout.write(prettyOutput);
            }
          }
          callback(err);
        });
      } catch (error) {
        // If signing fails, write original chunk
        writeStream.write(chunk, (err) => {
          if (prettyPrint && prettyFormatter) {
            process.stdout.write(chunk);
          }
          callback(err);
        });
      }
    },
    final(callback: (error?: Error | null) => void) {
      writeStream.end(() => callback());
    },
  });

  return signStream;
}

