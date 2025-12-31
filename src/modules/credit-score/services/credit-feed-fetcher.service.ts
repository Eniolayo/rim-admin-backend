import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import * as fs from 'fs/promises';
import * as path from 'path';
// S3 imports - optional, only needed if using S3 source
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import * as https from 'https';
import * as http from 'http';

export interface CreditFeedFile {
  filePath: string;
  fileName: string;
  fileType: 'csv' | 'xml';
  size: number;
}

@Injectable()
export class CreditFeedFetcherService {
  private readonly sourceType: 's3' | 'ftp' | 'local';
  private readonly s3Client?: S3Client;
  private readonly s3Bucket?: string;
  private readonly ftpHost?: string;
  private readonly ftpPort?: number;
  private readonly ftpUser?: string;
  private readonly ftpPassword?: string;
  private readonly localPath?: string;
  private readonly downloadPath: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: Logger,
  ) {
    this.sourceType =
      (this.configService.get<string>('CREDIT_FEED_SOURCE_TYPE') as
        | 's3'
        | 'ftp'
        | 'local') || 'local';

    // S3 Configuration (supports AWS S3 and DigitalOcean Spaces)
    if (this.sourceType === 's3') {
      // Check for DigitalOcean Spaces credentials first
      const doSpacesEndpoint = this.configService.get<string>('DO_SPACES_ENDPOINT');
      const doSpacesRegion = this.configService.get<string>('DO_SPACES_REGION');
      const doSpacesAccessKey = this.configService.get<string>('DO_SPACES_ACCESS_KEY');
      const doSpacesSecretKey = this.configService.get<string>('DO_SPACES_SECRET_KEY');
      const doSpacesBucket = this.configService.get<string>('DO_SPACES_BUCKET');

      // Use DigitalOcean Spaces if configured
      if (doSpacesEndpoint && doSpacesAccessKey && doSpacesSecretKey) {
        this.s3Client = new S3Client({
          endpoint: doSpacesEndpoint,
          region: doSpacesRegion || 'us-east-1',
          credentials: {
            accessKeyId: doSpacesAccessKey,
            secretAccessKey: doSpacesSecretKey,
          },
          forcePathStyle: false, // DigitalOcean Spaces uses virtual-hosted-style
        });
        this.s3Bucket = doSpacesBucket;
        this.logger.log('Configured S3 client for DigitalOcean Spaces');
      } else {
        // Fallback to standard S3 configuration
        const s3Region = this.configService.get<string>('CREDIT_FEED_S3_REGION') || 'us-east-1';
        const s3AccessKeyId = this.configService.get<string>('CREDIT_FEED_S3_ACCESS_KEY_ID');
        const s3SecretAccessKey = this.configService.get<string>('CREDIT_FEED_S3_SECRET_ACCESS_KEY');

        if (s3AccessKeyId && s3SecretAccessKey) {
          this.s3Client = new S3Client({
            region: s3Region,
            credentials: {
              accessKeyId: s3AccessKeyId,
              secretAccessKey: s3SecretAccessKey,
            },
          });
          this.s3Bucket = this.configService.get<string>('CREDIT_FEED_S3_BUCKET');
          this.logger.log('Configured S3 client for AWS S3');
        }
      }
    }

    // FTP Configuration
    if (this.sourceType === 'ftp') {
      this.ftpHost = this.configService.get<string>('CREDIT_FEED_FTP_HOST');
      this.ftpPort = this.configService.get<number>('CREDIT_FEED_FTP_PORT') || 21;
      this.ftpUser = this.configService.get<string>('CREDIT_FEED_FTP_USER');
      this.ftpPassword = this.configService.get<string>('CREDIT_FEED_FTP_PASSWORD');
    }

    // Local Path Configuration
    if (this.sourceType === 'local') {
      this.localPath =
        this.configService.get<string>('CREDIT_FEED_LOCAL_PATH') ||
        './credit-feeds';
    }

    // Download path for temporary files
    this.downloadPath =
      this.configService.get<string>('CREDIT_FEED_DOWNLOAD_PATH') ||
      './temp/credit-feeds';

    // Ensure download directory exists
    this.ensureDirectoryExists(this.downloadPath);
  }

  /**
   * Fetch credit feed files from configured source
   */
  async fetchFiles(): Promise<CreditFeedFile[]> {
    this.logger.log(
      { sourceType: this.sourceType },
      'Fetching credit feed files',
    );

    switch (this.sourceType) {
      case 's3':
        return await this.fetchFromS3();
      case 'ftp':
        return await this.fetchFromFTP();
      case 'local':
        return await this.fetchFromLocal();
      default:
        throw new Error(`Unsupported source type: ${this.sourceType}`);
    }
  }

  /**
   * Fetch files from S3
   */
  private async fetchFromS3(): Promise<CreditFeedFile[]> {
    if (!this.s3Client || !this.s3Bucket) {
      throw new Error('S3 client or bucket not configured');
    }

    // This is a simplified version - in production, you'd list objects in S3
    // and filter by prefix/pattern
    const files: CreditFeedFile[] = [];

    // Example: List objects with prefix 'credit-feeds/'
    // In production, implement S3 ListObjectsV2Command
    this.logger.warn('S3 fetching not fully implemented - requires S3 ListObjectsV2Command');

    return files;
  }

  /**
   * Fetch files from FTP
   */
  private async fetchFromFTP(): Promise<CreditFeedFile[]> {
    if (!this.ftpHost) {
      throw new Error('FTP host not configured');
    }

    // This is a simplified version - in production, use an FTP client library
    // like 'basic-ftp' or 'ssh2-sftp-client'
    this.logger.warn('FTP fetching not fully implemented - requires FTP client library');

    return [];
  }

  /**
   * Fetch files from local directory
   */
  private async fetchFromLocal(): Promise<CreditFeedFile[]> {
    if (!this.localPath) {
      throw new Error('Local path not configured');
    }

    try {
      await this.ensureDirectoryExists(this.localPath);

      const files = await fs.readdir(this.localPath);
      const creditFeedFiles: CreditFeedFile[] = [];

      for (const file of files) {
        const filePath = path.join(this.localPath, file);
        const stats = await fs.stat(filePath);

        // Only process regular files (not directories)
        if (!stats.isFile()) {
          continue;
        }

        // Check if file is CSV or XML
        const ext = path.extname(file).toLowerCase();
        if (ext === '.csv' || ext === '.xml') {
          creditFeedFiles.push({
            filePath,
            fileName: file,
            fileType: ext === '.csv' ? 'csv' : 'xml',
            size: stats.size,
          });
        }
      }

      this.logger.log(
        { count: creditFeedFiles.length },
        'Found credit feed files in local directory',
      );

      return creditFeedFiles;
    } catch (error) {
      this.logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        'Error fetching files from local directory',
      );
      throw error;
    }
  }

  /**
   * Download file to temporary location
   */
  async downloadFile(file: CreditFeedFile): Promise<string> {
    const downloadFilePath = path.join(
      this.downloadPath,
      `${Date.now()}-${file.fileName}`,
    );

    if (this.sourceType === 'local') {
      // For local files, just copy
      await fs.copyFile(file.filePath, downloadFilePath);
      return downloadFilePath;
    }

    // For S3/FTP, download the file
    // This would be implemented based on the source type
    throw new Error('File download not implemented for this source type');
  }

  /**
   * Move processed file to archive
   */
  async archiveFile(file: CreditFeedFile): Promise<void> {
    const archivePath =
      this.configService.get<string>('CREDIT_FEED_ARCHIVE_PATH') ||
      path.join(this.localPath || './credit-feeds', 'archive');

    await this.ensureDirectoryExists(archivePath);

    const archiveFilePath = path.join(
      archivePath,
      `${Date.now()}-${file.fileName}`,
    );

    if (this.sourceType === 'local') {
      await fs.rename(file.filePath, archiveFilePath);
      this.logger.debug(
        { fileName: file.fileName, archivePath: archiveFilePath },
        'File archived',
      );
    }
  }

  /**
   * Ensure directory exists
   */
  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }
}

