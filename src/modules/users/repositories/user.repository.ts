import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserStatus } from '../../../entities/user.entity';

@Injectable()
export class UserRepository {
  constructor(
    @InjectRepository(User)
    private readonly repository: Repository<User>,
  ) {}

  async findById(id: string): Promise<User | null> {
    return this.repository.findOne({
      where: { id },
      relations: ['loans'],
    });
  }

  async findByUserId(userId: string): Promise<User | null> {
    return this.repository.findOne({
      where: { userId },
      relations: ['loans'],
    });
  }

  async findByPhone(phone: string): Promise<User | null> {
    return this.repository.findOne({
      where: { phone },
      relations: ['loans'],
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.repository.findOne({
      where: { email },
      relations: ['loans'],
    });
  }

  async findAll(): Promise<User[]> {
    return this.repository.find({
      relations: ['loans'],
      order: { createdAt: 'DESC' },
    });
  }

  async findWithFilters(filters: {
    status?: string;
    repaymentStatus?: string;
    search?: string;
  }): Promise<User[]> {
    const queryBuilder = this.repository.createQueryBuilder('user');

    if (filters.status) {
      queryBuilder.andWhere('user.status = :status', {
        status: filters.status,
      });
    }

    if (filters.repaymentStatus) {
      queryBuilder.andWhere('user.repaymentStatus = :repaymentStatus', {
        repaymentStatus: filters.repaymentStatus,
      });
    }

    if (filters.search) {
      queryBuilder.andWhere(
        '(user.phone LIKE :search OR user.email LIKE :search OR user.userId LIKE :search)',
        { search: `%${filters.search}%` },
      );
    }

    return queryBuilder
      .leftJoinAndSelect('user.loans', 'loans')
      .orderBy('user.createdAt', 'DESC')
      .getMany();
  }

  async save(user: User): Promise<User> {
    return this.repository.save(user);
  }

  async update(
    id: string,
    updateData: Partial<Omit<User, 'loans'>>,
  ): Promise<void> {
    await this.repository.update(id, updateData);
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }

  async countByUserIdPattern(pattern: string): Promise<number> {
    return this.repository
      .createQueryBuilder('user')
      .where('user.userId LIKE :pattern', { pattern })
      .getCount();
  }

  async getStats(): Promise<{
    activeUsers: number;
    inactiveUsers: number;
    suspendedUsers: number;
    newUsers: number;
  }> {
    const [activeUsers, inactiveUsers, suspendedUsers] = await Promise.all([
      this.repository.count({ where: { status: UserStatus.ACTIVE } }),
      this.repository.count({ where: { status: UserStatus.INACTIVE } }),
      this.repository.count({ where: { status: UserStatus.SUSPENDED } }),
    ]);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const newUsers = await this.repository
      .createQueryBuilder('user')
      .where('user.createdAt >= :today AND user.createdAt < :tomorrow', {
        today,
        tomorrow,
      })
      .getCount();

    return {
      activeUsers,
      inactiveUsers,
      suspendedUsers,
      newUsers,
    };
  }
}
