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
   * Generate a new API token
   * @param createdBy - ID of the SuperAdmin creating the API key
   * @param name - External user's name
   * @param email - External user's email (must be unique)
   * @param description - Optional description
   * @returns Plain API token (only shown once)
   */
  async generateApiToken(
    createdBy: string,
    name: string,
    email: string,
    description?: string,
  ): Promise<{ token: string; entity: ApiKey }> {
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

    // Generate 96-character token (48 bytes = 96 hex characters)
    const token = this.generateSecureToken(48);
    const tokenPrefix = token.substring(0, 8); // First 8 chars for O(1) lookup
    const tokenHash = await bcrypt.hash(token, 10);

    // Calculate expiration date (30 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const apiKeyEntity = this.apiKeyRepository.create({
      tokenPrefix,
      tokenHash,
      name,
      email,
      description: description || null,
      status: ApiKeyStatus.ACTIVE,
      createdBy,
      expiresAt,
    });

    const saved = await this.apiKeyRepository.save(apiKeyEntity);

    this.logger.log(
      `API token generated for ${email} by ${creator.email} (ID: ${saved.id})`,
    );

    // Return plain token (only time it's visible)
    return {
      token,
      entity: saved,
    };
  }

  /**
   * Validate API token from request header
   * @param token - Plain API token from header (96 characters)
   * @returns Object containing AdminUser with superAdmin role and ApiKey entity if valid, null otherwise
   */
  async validateApiToken(
    token: string,
  ): Promise<{ user: AdminUser; apiKey: ApiKey } | null> {
    if (!token || token.length !== 96) {
      return null;
    }

    try {
      // Extract prefix for O(1) lookup
      const tokenPrefix = token.substring(0, 8);

      // Direct database lookup using indexed prefix
      const keyEntity = await this.apiKeyRepository.findOne({
        where: { tokenPrefix, status: ApiKeyStatus.ACTIVE },
        relations: ['creator'],
      });

      if (!keyEntity) {
        return null;
      }

      // Verify token with bcrypt comparison
      const isTokenValid = await bcrypt.compare(token, keyEntity.tokenHash);
      if (!isTokenValid) {
        return null;
      }

      // Check expiration
      if (keyEntity.expiresAt < new Date()) {
        this.logger.warn(`API key ${keyEntity.id} has expired`);
        keyEntity.status = ApiKeyStatus.INACTIVE;
        await this.apiKeyRepository.save(keyEntity);
        return null;
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
        `API token validated successfully for ${keyEntity.email}`,
      );
      return { user: creator, apiKey: keyEntity };
    } catch (error) {
      this.logger.error(
        `Error validating API token: ${error.message}`,
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

