import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class LogSigningService {
  private readonly signingKey: string;

  constructor(private readonly configService: ConfigService) {
    // Get signing key from environment or generate a secure key
    this.signingKey =
      this.configService.get<string>('LOG_SIGNING_KEY') ||
      this.generateSigningKey();
  }

  /**
   * Sign a log entry with HMAC-SHA256
   */
  signLogEntry(logData: Record<string, any>): string {
    // Create a deterministic string representation
    // Sort keys to ensure consistent hashing
    const sortedKeys = Object.keys(logData).sort();
    const sortedData: Record<string, any> = {};
    for (const key of sortedKeys) {
      sortedData[key] = logData[key];
    }

    const logString = JSON.stringify(sortedData);
    const signature = crypto
      .createHmac('sha256', this.signingKey)
      .update(logString)
      .digest('hex');

    return signature;
  }

  /**
   * Verify a log entry's signature
   */
  verifyLogEntry(
    logData: Record<string, any>,
    signature: string,
  ): boolean {
    const expectedSignature = this.signLogEntry(logData);
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature),
    );
  }

  /**
   * Generate a signing key (for development/testing)
   */
  private generateSigningKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Get the signing key (for transport initialization)
   */
  getSigningKey(): string {
    return this.signingKey;
  }
}




