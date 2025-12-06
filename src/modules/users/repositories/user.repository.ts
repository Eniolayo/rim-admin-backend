import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  User,
  UserStatus,
  RepaymentStatus,
} from '../../../entities/user.entity';
import { normalizeNigerianPhone } from '../../../common/utils/phone.utils';

@Injectable()
export class UserRepository {
  constructor(
    @InjectRepository(User)
    private readonly repository: Repository<User>,
  ) {}

  async findById(id: string): Promise<User | null> {
    try {
      // Check if it's a UUID format (8-4-4-4-12 hex characters)
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      if (uuidRegex.test(id)) {
        // It's a UUID, search by id field
        return this.repository.findOne({
          where: { id },
          relations: ['loans'],
        });
      } else {
        // It's likely a custom userId, search by userId field
        return this.repository.findOne({
          where: { userId: id },
          relations: ['loans'],
        });
      }
    } catch (error) {
      // Log the error for debugging
      throw new BadRequestException(`Invalid user identifier format: ${id}`);
    }
  }

  async findByUserId(userId: string): Promise<User | null> {
    return this.repository.findOne({
      where: { userId },
      relations: ['loans'],
    });
  }

  async findByPhone(phone: string): Promise<User | null> {
    // Normalize the phone number for consistent searching
    const normalizedPhone = normalizeNigerianPhone(phone);

    if (!normalizedPhone) {
      return null;
    }

    // First, try to find with normalized phone (for newly created users)
    let user = await this.repository.findOne({
      where: { phone: normalizedPhone },
      relations: ['loans'],
    });

    if (user) {
      return user;
    }

    // If not found, try common variations for backward compatibility
    // Extract digits only from normalized phone (remove leading 0)
    const digitsOnly = normalizedPhone.replace(/\D/g, '');
    const withoutLeadingZero = digitsOnly.startsWith('0')
      ? digitsOnly.slice(1)
      : digitsOnly;

    // Try different formats that might exist in the database
    const variations = [
      `+234${withoutLeadingZero}`, // International format without spaces: +2348038381446
      `+234 ${withoutLeadingZero.slice(0, 3)} ${withoutLeadingZero.slice(3, 6)} ${withoutLeadingZero.slice(6)}`, // International with spaces: +234 803 838 1446
      `234${withoutLeadingZero}`, // Without +: 2348038381446
    ];

    // Try each variation
    for (const variation of variations) {
      user = await this.repository.findOne({
        where: { phone: variation },
        relations: ['loans'],
      });
      if (user) {
        return user;
      }
    }

    // Last resort: Use a query to find phones that contain the core digits
    // This handles cases where phone might be stored with different formatting
    if (digitsOnly.length >= 10) {
      const localPart = digitsOnly.slice(-10); // Last 10 digits (the local number)
      user = await this.repository
        .createQueryBuilder('user')
        .leftJoinAndSelect('user.loans', 'loans')
        .where('user.phone LIKE :pattern', { pattern: `%${localPart}%` })
        .getOne();

      if (user) {
        // Verify the normalized phone matches to ensure we found the right user
        const userNormalizedPhone = normalizeNigerianPhone(user.phone);
        if (userNormalizedPhone === normalizedPhone) {
          return user;
        }
      }
    }

    return null;
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
    status?: UserStatus;
    repaymentStatus?: string;
    search?: string;
    minCreditScore?: number;
    maxCreditScore?: number;
    page?: number;
    limit?: number;
  }): Promise<[User[], number]> {
    const queryBuilder = this.repository.createQueryBuilder('user');

    if (filters.status) {
      queryBuilder.andWhere('user.status = :status', {
        status: filters.status,
      });
    }

    if (filters.repaymentStatus) {
      // Normalize repaymentStatus: capitalize first letter, lowercase rest
      const normalizedRepaymentStatus =
        filters.repaymentStatus.charAt(0).toUpperCase() +
        filters.repaymentStatus.slice(1).toLowerCase();

      // Validate against enum values
      const validStatuses = Object.values(RepaymentStatus);
      if (
        !validStatuses.includes(normalizedRepaymentStatus as RepaymentStatus)
      ) {
        throw new BadRequestException(
          `Invalid repaymentStatus: "${filters.repaymentStatus}". Valid values are: ${validStatuses.join(', ')}`,
        );
      }

      queryBuilder.andWhere('user.repaymentStatus = :repaymentStatus', {
        repaymentStatus: normalizedRepaymentStatus,
      });
    }

    if (filters.search) {
      queryBuilder.andWhere(
        '(user.phone LIKE :search OR user.email LIKE :search OR user.userId LIKE :search)',
        { search: `%${filters.search}%` },
      );
    }

    if (filters.minCreditScore !== undefined) {
      queryBuilder.andWhere('user.creditScore >= :minCreditScore', {
        minCreditScore: filters.minCreditScore,
      });
    }

    if (filters.maxCreditScore !== undefined) {
      queryBuilder.andWhere('user.creditScore <= :maxCreditScore', {
        maxCreditScore: filters.maxCreditScore,
      });
    }

    // Apply pagination
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 10;
    const skip = (page - 1) * limit;

    queryBuilder.skip(skip).take(limit);

    return queryBuilder
      .leftJoinAndSelect('user.loans', 'loans')
      .orderBy('user.createdAt', 'DESC')
      .getManyAndCount();
  }

  async findAllForExport(filters: {
    status?: UserStatus;
    repaymentStatus?: string;
    search?: string;
    minCreditScore?: number;
    maxCreditScore?: number;
  }): Promise<User[]> {
    const queryBuilder = this.repository.createQueryBuilder('user');

    if (filters.status) {
      queryBuilder.andWhere('user.status = :status', {
        status: filters.status,
      });
    }

    if (filters.repaymentStatus) {
      // Normalize repaymentStatus: capitalize first letter, lowercase rest
      const normalizedRepaymentStatus =
        filters.repaymentStatus.charAt(0).toUpperCase() +
        filters.repaymentStatus.slice(1).toLowerCase();

      // Validate against enum values
      const validStatuses = Object.values(RepaymentStatus);
      if (
        !validStatuses.includes(normalizedRepaymentStatus as RepaymentStatus)
      ) {
        throw new BadRequestException(
          `Invalid repaymentStatus: "${filters.repaymentStatus}". Valid values are: ${validStatuses.join(', ')}`,
        );
      }

      queryBuilder.andWhere('user.repaymentStatus = :repaymentStatus', {
        repaymentStatus: normalizedRepaymentStatus,
      });
    }

    if (filters.search) {
      queryBuilder.andWhere(
        '(user.phone LIKE :search OR user.email LIKE :search OR user.userId LIKE :search)',
        { search: `%${filters.search}%` },
      );
    }

    if (filters.minCreditScore !== undefined) {
      queryBuilder.andWhere('user.creditScore >= :minCreditScore', {
        minCreditScore: filters.minCreditScore,
      });
    }

    if (filters.maxCreditScore !== undefined) {
      queryBuilder.andWhere('user.creditScore <= :maxCreditScore', {
        maxCreditScore: filters.maxCreditScore,
      });
    }

    // No pagination - return all matching records
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
    totalUsers: number;
    avgCreditScore: number;
  }> {
    const [
      activeUsers,
      inactiveUsers,
      suspendedUsers,
      totalUsers,
      avgCreditScoreResult,
    ] = await Promise.all([
      this.repository.count({ where: { status: UserStatus.ACTIVE } }),
      this.repository.count({ where: { status: UserStatus.INACTIVE } }),
      this.repository.count({ where: { status: UserStatus.SUSPENDED } }),
      this.repository.count(),
      this.repository
        .createQueryBuilder('user')
        .select('AVG(user.creditScore)', 'avg')
        .getRawOne(),
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
      totalUsers,
      avgCreditScore: avgCreditScoreResult?.avg
        ? parseFloat(avgCreditScoreResult.avg)
        : 0,
    };
  }
}
