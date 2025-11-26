import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { ApiKey, ApiKeyStatus } from '../../../entities/api-key.entity';
import { AdminUser } from '../../../entities/admin-user.entity';
import { AdminRole } from '../../../entities/admin-role.entity';

@Injectable()
export class ApiKeyService {
  private readonly logger = new Logger(ApiKeyService.name);

  constructor(
    @InjectRepository(ApiKey)
    private readonly apiKeyRepository: Repository<ApiKey>,
    @InjectRepository(AdminUser)
    private readonly adminUserRepository: Repository<AdminUser>,
    @InjectRepository(AdminRole)
    private readonly adminRoleRepository: Repository<AdminRole>,
  ) {}

  /**
   * Generate a new API key and secret pair
   * @param createdBy - ID of the SuperAdmin creating the API key
   * @param name - External user's name
   * @param email - External user's email (must be unique)
   * @param description - Optional description
   * @returns Plain API key and secret (only shown once)
   */
  async generateApiKey(
    createdBy: string,
    name: string,
    email: string,
    description?: string,
  ): Promise<{ apiKey: string; apiSecret: string; entity: ApiKey }> {
    // Check if email already has an active API key
    const existingKey = await this.apiKeyRepository.findOne({
      where: { email, status: ApiKeyStatus.ACTIVE },
    });

    if (existingKey) {
      throw new BadRequestException(
        `An active API key already exists for email: ${email}`,
      );
    }

    // Verify the creator is a SuperAdmin
    const creator = await this.adminUserRepository.findOne({
      where: { id: createdBy },
      relations: ['roleEntity'],
    });

    if (!creator) {
      throw new NotFoundException('Creator not found');
    }

    if (!creator.roleEntity) {
      throw new BadRequestException('Creator has no role assigned');
    }

    const roleName = creator.roleEntity.name.toLowerCase().trim();
    if (roleName !== 'super_admin') {
      throw new BadRequestException(
        'Only Super Admin users can create API keys',
      );
    }

    // Generate API key (32 characters)
    const apiKey = this.generateSecureToken(32);
    const apiKeyHash = await bcrypt.hash(apiKey, 10);

    // Generate API secret (64 characters)
    const apiSecret = this.generateSecureToken(64);
    const apiSecretHash = await bcrypt.hash(apiSecret, 10);

    // Calculate expiration date (30 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const apiKeyEntity = this.apiKeyRepository.create({
      apiKey: apiKeyHash, // Store hash in apiKey field
      apiKeyHash,
      apiSecret: apiSecretHash,
      name,
      email,
      description: description || null,
      status: ApiKeyStatus.ACTIVE,
      createdBy,
      expiresAt,
    });

    const saved = await this.apiKeyRepository.save(apiKeyEntity);

    this.logger.log(
      `API key generated for ${email} by ${creator.email} (ID: ${saved.id})`,
    );

    // Return plain values (only time they're visible)
    return {
      apiKey,
      apiSecret,
      entity: saved,
    };
  }

  /**
   * Validate API key and secret from request headers
   * @param apiKey - Plain API key from header
   * @param apiSecret - Plain API secret from header
   * @returns AdminUser with superAdmin role if valid, null otherwise
   */
  async validateApiKey(
    apiKey: string,
    apiSecret: string,
  ): Promise<AdminUser | null> {
    if (!apiKey || !apiSecret) {
      return null;
    }

    try {
      // Find all active API keys
      const apiKeys = await this.apiKeyRepository.find({
        where: { status: ApiKeyStatus.ACTIVE },
        relations: ['creator'],
      });

      for (const keyEntity of apiKeys) {
        // Verify API key
        const isKeyValid = await bcrypt.compare(apiKey, keyEntity.apiKeyHash);
        if (!isKeyValid) continue;

        // Verify API secret
        const isSecretValid = await bcrypt.compare(apiSecret, keyEntity.apiSecret);
        if (!isSecretValid) continue;

        // Check expiration
        if (keyEntity.expiresAt < new Date()) {
          this.logger.warn(`API key ${keyEntity.id} has expired`);
          // Optionally update status to inactive
          keyEntity.status = ApiKeyStatus.INACTIVE;
          await this.apiKeyRepository.save(keyEntity);
          continue;
        }

        // Update last used timestamp
        keyEntity.lastUsedAt = new Date();
        await this.apiKeyRepository.save(keyEntity);

        // Get the creator and ensure they have superAdmin role
        const creator = await this.adminUserRepository.findOne({
          where: { id: keyEntity.createdBy },
          relations: ['roleEntity'],
        });

        if (!creator) {
          this.logger.warn(
            `API key creator ${keyEntity.createdBy} not found`,
          );
          return null;
        }

        // Verify creator has superAdmin role
        if (!creator.roleEntity) {
          this.logger.warn(
            `API key creator ${keyEntity.createdBy} has no role`,
          );
          return null;
        }

        const roleName = creator.roleEntity.name.toLowerCase().trim();
        if (roleName !== 'super_admin') {
          this.logger.warn(
            `API key creator ${keyEntity.createdBy} does not have superAdmin role (has: ${roleName})`,
          );
          return null;
        }

        this.logger.debug(
          `API key validated successfully for ${keyEntity.email}`,
        );
        return creator;
      }

      return null;
    } catch (error) {
      this.logger.error(
        `Error validating API key: ${error.message}`,
        error.stack,
      );
      return null;
    }
  }

  /**
   * Revoke an API key
   * @param id - API key ID
   * @param revokedBy - ID of admin revoking the key
   */
  async revokeApiKey(id: string, revokedBy: string): Promise<void> {
    const apiKey = await this.apiKeyRepository.findOne({
      where: { id },
    });

    if (!apiKey) {
      throw new NotFoundException('API key not found');
    }

    apiKey.status = ApiKeyStatus.REVOKED;
    await this.apiKeyRepository.save(apiKey);

    this.logger.log(`API key ${id} revoked by ${revokedBy}`);
  }

  /**
   * List all API keys (for admin management)
   * @param createdBy - Optional filter by creator ID
   * @returns Array of API keys without sensitive data
   */
  async listApiKeys(createdBy?: string): Promise<ApiKey[]> {
    const where: any = {};
    if (createdBy) {
      where.createdBy = createdBy;
    }

    return this.apiKeyRepository.find({
      where,
      relations: ['creator'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get API key by ID
   * @param id - API key ID
   * @returns API key entity
   */
  async getApiKeyById(id: string): Promise<ApiKey> {
    const apiKey = await this.apiKeyRepository.findOne({
      where: { id },
      relations: ['creator'],
    });

    if (!apiKey) {
      throw new NotFoundException('API key not found');
    }

    return apiKey;
  }

  /**
   * Get API key by email
   * @param email - Email address
   * @returns API key entity or null
   */
  async getApiKeyByEmail(email: string): Promise<ApiKey | null> {
    return this.apiKeyRepository.findOne({
      where: { email },
      relations: ['creator'],
    });
  }

  /**
   * Generate a secure random token
   * @param length - Length in bytes (will be doubled for hex string)
   * @returns Hexadecimal string token
   */
  private generateSecureToken(length: number): string {
    return crypto.randomBytes(length).toString('hex');
  }
}

