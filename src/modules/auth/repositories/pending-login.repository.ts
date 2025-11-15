import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PendingLogin } from '../../../entities/pending-login.entity';

@Injectable()
export class PendingLoginRepository {
  constructor(
    @InjectRepository(PendingLogin)
    private readonly repository: Repository<PendingLogin>,
  ) {}

  async findActiveByHash(hash: string): Promise<PendingLogin | null> {
    return this.repository.findOne({ where: { hash, used: false } });
  }

  async findByHash(hash: string): Promise<PendingLogin | null> {
    return this.repository.findOne({ where: { hash } });
  }

  async findActiveByUserAndType(
    adminUserId: string,
    type: 'mfa' | 'setup',
  ): Promise<PendingLogin | null> {
    return this.repository.findOne({
      where: { adminUserId, type, used: false },
    });
  }

  async save(entity: PendingLogin): Promise<PendingLogin> {
    return this.repository.save(entity);
  }

  async markUsed(id: string): Promise<void> {
    await this.repository.update(id, { used: true });
  }

  async deleteExpiredForUser(adminUserId: string, now: Date): Promise<void> {
    await this.repository
      .createQueryBuilder()
      .delete()
      .from(PendingLogin)
      .where('adminUserId = :adminUserId', { adminUserId })
      .andWhere('expiresAt < :now', { now })
      .execute();
  }

  async deleteUsedForUser(adminUserId: string): Promise<void> {
    await this.repository
      .createQueryBuilder()
      .delete()
      .from(PendingLogin)
      .where('adminUserId = :adminUserId', { adminUserId })
      .andWhere('used = :used', { used: true })
      .execute();
  }
}

