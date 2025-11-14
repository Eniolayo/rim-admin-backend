import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminUser } from '../../../entities/admin-user.entity';

@Injectable()
export class AdminUserRepository {
  constructor(
    @InjectRepository(AdminUser)
    private readonly repository: Repository<AdminUser>,
  ) {}

  async findById(id: string): Promise<AdminUser | null> {
    return this.repository.findOne({
      where: { id },
      relations: ['roleEntity'],
    });
  }

  async findByEmail(email: string): Promise<AdminUser | null> {
    return this.repository.findOne({
      where: { email },
      relations: ['roleEntity'],
    });
  }

  async findByUsername(username: string): Promise<AdminUser | null> {
    return this.repository.findOne({
      where: { username },
      relations: ['roleEntity'],
    });
  }

  async save(adminUser: AdminUser): Promise<AdminUser> {
    return this.repository.save(adminUser);
  }

  async updateRefreshToken(
    id: string,
    refreshToken: string | null,
  ): Promise<void> {
    await this.repository.update(id, { refreshToken });
  }
}
