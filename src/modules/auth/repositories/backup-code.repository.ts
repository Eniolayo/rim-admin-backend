import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BackupCode } from '../../../entities/backup-code.entity';

@Injectable()
export class BackupCodeRepository {
  constructor(
    @InjectRepository(BackupCode)
    private readonly repository: Repository<BackupCode>,
  ) {}

  async findActiveByUser(adminUserId: string): Promise<BackupCode[]> {
    return this.repository.find({ where: { adminUserId, used: false } });
  }

  async findOneActiveByUser(
    adminUserId: string,
    codeHash: string,
  ): Promise<BackupCode | null> {
    return this.repository.findOne({
      where: { adminUserId, codeHash, used: false },
    });
  }

  async saveAll(entities: BackupCode[]): Promise<BackupCode[]> {
    return this.repository.save(entities);
  }

  async markUsed(id: string): Promise<void> {
    await this.repository.update(id, { used: true });
  }

  async deleteAllForUser(adminUserId: string): Promise<void> {
    await this.repository
      .createQueryBuilder()
      .delete()
      .from(BackupCode)
      .where('adminUserId = :adminUserId', { adminUserId })
      .execute();
  }
}

