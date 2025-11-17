import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemConfig } from '../../../entities/system-config.entity';

@Injectable()
export class SystemConfigRepository {
  constructor(
    @InjectRepository(SystemConfig)
    private readonly repository: Repository<SystemConfig>,
  ) {}

  async findAll(category?: string): Promise<SystemConfig[]> {
    if (category) {
      return this.repository.find({
        where: { category },
        order: { category: 'ASC', key: 'ASC' },
      });
    }
    return this.repository.find({
      order: { category: 'ASC', key: 'ASC' },
    });
  }

  async findOne(id: string): Promise<SystemConfig | null> {
    return this.repository.findOne({ where: { id } });
  }

  async findByCategoryAndKey(
    category: string,
    key: string,
  ): Promise<SystemConfig | null> {
    return this.repository.findOne({
      where: { category, key },
    });
  }

  async create(config: Partial<SystemConfig>): Promise<SystemConfig> {
    const newConfig = this.repository.create(config);
    return this.repository.save(newConfig);
  }

  async update(
    id: string,
    updates: Partial<SystemConfig>,
  ): Promise<SystemConfig> {
    await this.repository.update(id, updates);
    const updated = await this.findOne(id);
    if (!updated) {
      throw new Error(`SystemConfig with id ${id} not found`);
    }
    return updated;
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }

  async exists(category: string, key: string): Promise<boolean> {
    const count = await this.repository.count({
      where: { category, key },
    });
    return count > 0;
  }
}
