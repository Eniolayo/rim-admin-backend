import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { SystemConfigRepository } from '../repositories/system-config.repository';
import {
  CreateSystemConfigDto,
  UpdateSystemConfigDto,
  SystemConfigResponseDto,
  SystemConfigQueryDto,
} from '../dto/system-config.dto';
import { SystemConfig } from '../../../entities/system-config.entity';
import { AdminUser } from '../../../entities/admin-user.entity';

@Injectable()
export class SystemConfigService {
  constructor(
    private readonly repository: SystemConfigRepository,
    private readonly logger: Logger,
  ) {}

  async findAll(
    query?: SystemConfigQueryDto,
  ): Promise<SystemConfigResponseDto[]> {
    this.logger.debug('Finding all system configs', { query });

    const configs = await this.repository.findAll(query?.category);
    return configs.map((config) => this.mapToResponse(config));
  }

  async findOne(id: string): Promise<SystemConfigResponseDto> {
    this.logger.debug({ configId: id }, 'Finding system config');

    const config = await this.repository.findOne(id);
    if (!config) {
      throw new NotFoundException(`SystemConfig with ID ${id} not found`);
    }

    return this.mapToResponse(config);
  }

  async findByCategoryAndKey(
    category: string,
    key: string,
  ): Promise<SystemConfigResponseDto | null> {
    const config = await this.repository.findByCategoryAndKey(category, key);
    return config ? this.mapToResponse(config) : null;
  }

  async getValue<T = unknown>(
    category: string,
    key: string,
    defaultValue?: T,
  ): Promise<T> {
    const config = await this.repository.findByCategoryAndKey(category, key);
    if (!config) {
      if (defaultValue !== undefined) {
        return defaultValue;
      }
      throw new NotFoundException(
        `SystemConfig with category ${category} and key ${key} not found`,
      );
    }
    return config.value as T;
  }

  async create(
    createDto: CreateSystemConfigDto,
    adminUser: AdminUser,
  ): Promise<SystemConfigResponseDto> {
    this.logger.log('Creating system config', { category: createDto.category, key: createDto.key });

    // Check if config already exists
    const exists = await this.repository.exists(createDto.category, createDto.key);
    if (exists) {
      throw new ConflictException(
        `SystemConfig with category ${createDto.category} and key ${createDto.key} already exists`,
      );
    }

    const config = await this.repository.create({
      ...createDto,
      updatedBy: adminUser.id,
    });

    this.logger.log({ configId: config.id }, 'System config created');
    return this.mapToResponse(config);
  }

  async update(
    id: string,
    updateDto: UpdateSystemConfigDto,
    adminUser: AdminUser,
  ): Promise<SystemConfigResponseDto> {
    this.logger.log({ configId: id }, 'Updating system config');

    const config = await this.repository.findOne(id);
    if (!config) {
      throw new NotFoundException(`SystemConfig with ID ${id} not found`);
    }

    const updated = await this.repository.update(id, {
      ...updateDto,
      updatedBy: adminUser.id,
    });

    this.logger.log({ configId: id }, 'System config updated');
    return this.mapToResponse(updated);
  }

  async upsert(
    category: string,
    key: string,
    value: string | number | boolean | object | unknown[],
    description?: string,
    adminUser?: AdminUser,
  ): Promise<SystemConfigResponseDto> {
    this.logger.log('Upserting system config', { category, key });

    const existing = await this.repository.findByCategoryAndKey(category, key);
    if (existing) {
      return this.update(
        existing.id,
        { value, description },
        adminUser!,
      );
    } else {
      return this.create(
        { category, key, value, description },
        adminUser!,
      );
    }
  }

  async delete(id: string): Promise<void> {
    this.logger.log({ configId: id }, 'Deleting system config');

    const config = await this.repository.findOne(id);
    if (!config) {
      throw new NotFoundException(`SystemConfig with ID ${id} not found`);
    }

    await this.repository.delete(id);
    this.logger.log({ configId: id }, 'System config deleted');
  }

  private mapToResponse(config: SystemConfig): SystemConfigResponseDto {
    return {
      id: config.id,
      category: config.category,
      key: config.key,
      value: config.value,
      description: config.description,
      updatedBy: config.updatedBy,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };
  }
}
