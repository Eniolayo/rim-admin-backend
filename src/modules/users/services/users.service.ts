import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { UserRepository } from '../repositories/user.repository';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CreateUserDto,
  UpdateUserDto,
  UserResponseDto,
  UserStatsDto,
  UserQueryDto,
  PaginatedResponseDto,
} from '../dto';
import {
  User,
  UserStatus,
  RepaymentStatus,
} from '../../../entities/user.entity';
import { UsersCacheService } from './users-cache.service';
import { CreditScoreService } from '../../credit-score/services/credit-score.service';
import { SystemConfigService } from '../../system-config/services/system-config.service';

interface CreditScoreThreshold {
  score: number;
  amount: number;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly userRepository: UserRepository,
    @InjectRepository(User)
    private readonly repository: Repository<User>,
    private readonly cacheService: UsersCacheService,
    private readonly creditScoreService: CreditScoreService,
    private readonly systemConfigService: SystemConfigService,
    private readonly logger: Logger,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<UserResponseDto> {
    this.logger.log({ phone: createUserDto.phone }, 'Creating new user');

    // Check if a user with this phone number already exists
    const existingUser = await this.userRepository.findByPhone(
      createUserDto.phone,
    );
    if (existingUser) {
      this.logger.warn(
        { phone: createUserDto.phone, existingUserId: existingUser.userId },
        'Attempted to create user with duplicate phone number',
      );
      throw new BadRequestException(
        `A user with phone number "${createUserDto.phone}" already exists. Phone numbers must be unique.`,
      );
    }

    // Generate userId
    const userId = await this.generateUserId();

    // Get first-time user default credit score from system config
    let creditScore = 0;
    try {
      creditScore = await this.systemConfigService.getValue<number>(
        'credit_score',
        'first_timer_default_score',
        0,
      );
      this.logger.debug(
        { creditScore },
        'Using first-time user default credit score',
      );
    } catch (error) {
      this.logger.warn(
        {
          error: error instanceof Error ? error.message : String(error),
        },
        'Error getting first_timer_default_score, using default 0',
      );
      creditScore = 0;
    }

    // Calculate credit limit from thresholds based on credit score
    let creditLimit = 0;
    try {
      const thresholdsJson = await this.systemConfigService.getValue<
        CreditScoreThreshold[]
      >('credit_score', 'thresholds', [
        { score: 0, amount: 500 },
        { score: 1000, amount: 1000 },
      ]);

      // Find highest threshold user qualifies for
      let calculatedLimit = 500; // Default minimum

      // Sort thresholds by score descending
      const sortedThresholds = [...thresholdsJson].sort(
        (a, b) => b.score - a.score,
      );

      for (const threshold of sortedThresholds) {
        if (creditScore >= threshold.score) {
          calculatedLimit = threshold.amount;
          break;
        }
      }

      creditLimit = calculatedLimit;
      this.logger.debug(
        { creditScore, creditLimit },
        'Calculated credit limit from thresholds',
      );
    } catch (error) {
      this.logger.warn(
        {
          error: error instanceof Error ? error.message : String(error),
        },
        'Error getting thresholds, using default 0',
      );
      creditLimit = 0;
    }

    const user = this.repository.create({
      ...createUserDto,
      userId,
      creditScore, // Use auto-calculated value, ignore if provided in DTO
      creditLimit, // Use auto-calculated value, ignore if provided in DTO
      autoLimitEnabled: createUserDto.autoLimitEnabled ?? false,
      status: createUserDto.status ?? UserStatus.ACTIVE,
      repaymentStatus: RepaymentStatus.COMPLETED, // New users always start with Completed status
      totalRepaid: 0,
      totalLoans: 0,
    });

    const savedUser = await this.userRepository.save(user);
    this.logger.log({ userId: savedUser.userId }, 'User created');

    // Invalidate cache - list and stats changed
    try {
      await Promise.all([
        this.cacheService.invalidateUserList(),
        this.cacheService.invalidateUserStats(),
      ]);
    } catch (error) {
      // Cache invalidation error - log but don't fail
      this.logger.warn(
        { error: error instanceof Error ? error.message : String(error) },
        'Error invalidating cache after user creation',
      );
    }

    return this.mapToResponse(savedUser);
  }

  async findAll(
    queryDto?: UserQueryDto,
  ): Promise<PaginatedResponseDto<UserResponseDto>> {
    this.logger.debug('Finding all users');

    try {
      // Validate credit score range
      if (
        queryDto?.minCreditScore !== undefined &&
        queryDto?.maxCreditScore !== undefined &&
        queryDto.minCreditScore > queryDto.maxCreditScore
      ) {
        throw new BadRequestException(
          'minCreditScore cannot be greater than maxCreditScore',
        );
      }

      // Try to get from cache
      try {
        const cached = await this.cacheService.getUserList(queryDto);
        if (cached) {
          return cached;
        }
      } catch (error) {
        // Cache error - fallback to database
        this.logger.warn(
          { error: error instanceof Error ? error.message : String(error) },
          'Cache error, falling back to database',
        );
      }

      // If no filters provided, use default pagination
      if (!queryDto || Object.keys(queryDto).length === 0) {
        const [users, total] = await this.userRepository.findWithFilters({
          page: 1,
          limit: 10,
        });

        const result = {
          data: users.map((user) => this.mapToResponse(user)),
          total,
          page: 1,
          limit: 10,
          totalPages: Math.ceil(total / 10),
        };

        // Cache the result
        try {
          await this.cacheService.setUserList(undefined, result);
        } catch (error) {
          // Cache error - continue without caching
          this.logger.warn(
            { error: error instanceof Error ? error.message : String(error) },
            'Error caching user list',
          );
        }

        return result;
      }

      const page = queryDto.page ?? 1;
      const limit = queryDto.limit ?? 10;

      const [users, total] = await this.userRepository.findWithFilters({
        status: queryDto.status,
        repaymentStatus: queryDto.repaymentStatus,
        search: queryDto.search,
        minCreditScore: queryDto.minCreditScore,
        maxCreditScore: queryDto.maxCreditScore,
        page,
        limit,
      });

      const result = {
        data: users.map((user) => this.mapToResponse(user)),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };

      // Cache the result
      try {
        await this.cacheService.setUserList(queryDto, result);
      } catch (error) {
        // Cache error - continue without caching
        this.logger.warn(
          { error: error instanceof Error ? error.message : String(error) },
          'Error caching user list',
        );
      }

      return result;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
        'Error finding users',
      );
      throw new BadRequestException('Error retrieving users');
    }
  }

  async findOne(id: string): Promise<UserResponseDto> {
    this.logger.debug({ userId: id }, 'Finding user');

    // Validate input
    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      throw new BadRequestException('User ID is required and must be a non-empty string');
    }

    const trimmedId = id.trim();

    try {
      // Try to get from cache
      try {
        const cached = await this.cacheService.getUser(trimmedId);
        if (cached) {
          return cached;
        }
      } catch (error) {
        // Cache error - fallback to database
        this.logger.warn(
          {
            error: error instanceof Error ? error.message : String(error),
            userId: trimmedId,
          },
          'Cache error, falling back to database',
        );
      }

      // Find user by ID (handles both UUID and custom userId)
      const user = await this.userRepository.findById(trimmedId);

      if (!user) {
        this.logger.warn({ userId: trimmedId }, 'User not found');
        throw new NotFoundException(`User with ID "${trimmedId}" not found`);
      }

      const result = this.mapToResponse(user);

      // Cache the result
      try {
        await this.cacheService.setUser(trimmedId, result);
      } catch (error) {
        // Cache error - continue without caching
        this.logger.warn(
          {
            error: error instanceof Error ? error.message : String(error),
            userId: trimmedId,
          },
          'Error caching user',
        );
      }

      return result;
    } catch (error) {
      // Re-throw known exceptions
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }

      // Handle database errors
      if (error && typeof error === 'object' && 'code' in error) {
        const dbError = error as { code: string; message?: string };
        
        if (dbError.code === '22P02') {
          // PostgreSQL invalid UUID format error
          this.logger.error(
            { error: dbError.message, userId: trimmedId },
            'Invalid user ID format',
          );
          throw new BadRequestException(
            `Invalid user ID format: "${trimmedId}". Please provide a valid UUID or user ID (e.g., USR-2025-002).`,
          );
        }
      }

      // Log unexpected errors
      this.logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          userId: trimmedId,
        },
        'Error finding user',
      );

      // Return a generic error to avoid exposing internal details
      throw new BadRequestException(
        `Unable to retrieve user with ID "${trimmedId}". Please verify the ID and try again.`,
      );
    }
  }

  async update(
    id: string,
    updateUserDto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    this.logger.log({ userId: id }, 'Updating user');

    const user = await this.userRepository.findById(id);

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    Object.assign(user, updateUserDto);
    const updatedUser = await this.userRepository.save(user);

    this.logger.log({ userId: updatedUser.userId }, 'User updated');

    // Invalidate cache - user, list, and stats changed
    try {
      await Promise.all([
        this.cacheService.invalidateUser(id),
        this.cacheService.invalidateUserList(),
        this.cacheService.invalidateUserStats(),
      ]);
    } catch (error) {
      // Cache invalidation error - log but don't fail
      this.logger.warn(
        {
          error: error instanceof Error ? error.message : String(error),
          userId: id,
        },
        'Error invalidating cache after user update',
      );
    }

    return this.mapToResponse(updatedUser);
  }

  async updateStatus(id: string, status: UserStatus): Promise<UserResponseDto> {
    this.logger.log({ userId: id, status }, 'Updating user status');

    const user = await this.userRepository.findById(id);

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    user.status = status;
    const updatedUser = await this.userRepository.save(user);

    // Invalidate cache - user, list, and stats changed
    try {
      await Promise.all([
        this.cacheService.invalidateUser(id),
        this.cacheService.invalidateUserList(),
        this.cacheService.invalidateUserStats(),
      ]);
    } catch (error) {
      // Cache invalidation error - log but don't fail
      this.logger.warn(
        {
          error: error instanceof Error ? error.message : String(error),
          userId: id,
        },
        'Error invalidating cache after status update',
      );
    }

    return this.mapToResponse(updatedUser);
  }

  async updateCreditLimit(
    id: string,
    creditLimit: number,
    autoLimitEnabled?: boolean,
  ): Promise<UserResponseDto> {
    this.logger.log(
      { userId: id, creditLimit, autoLimitEnabled },
      'Updating credit limit for user',
    );

    const user = await this.userRepository.findById(id);

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // If enabling auto-limit, calculate based on credit score
    if (autoLimitEnabled === true) {
      user.creditLimit = this.calculateCreditLimitByScore(user.creditScore);
      user.autoLimitEnabled = true;
    } else if (autoLimitEnabled === false) {
      // If disabling auto-limit, use the provided credit limit
      user.creditLimit = creditLimit;
      user.autoLimitEnabled = false;
    } else {
      // If autoLimitEnabled is undefined, just update the credit limit
      user.creditLimit = creditLimit;
    }

    const updatedUser = await this.userRepository.save(user);

    // Invalidate cache - user, list, and stats changed
    try {
      await Promise.all([
        this.cacheService.invalidateUser(id),
        this.cacheService.invalidateUserList(),
        this.cacheService.invalidateUserStats(),
      ]);
    } catch (error) {
      // Cache invalidation error - log but don't fail
      this.logger.warn(
        {
          error: error instanceof Error ? error.message : String(error),
          userId: id,
        },
        'Error invalidating cache after credit limit update',
      );
    }

    return this.mapToResponse(updatedUser);
  }

  async bulkUpdateStatus(
    ids: string[],
    status: UserStatus,
  ): Promise<UserResponseDto[]> {
    this.logger.log(
      { userIds: ids, status, count: ids.length },
      'Bulk updating status for users',
    );

    const users = await Promise.all(
      ids.map(async (id) => {
        const user = await this.userRepository.findById(id);
        if (!user) {
          throw new NotFoundException(`User with ID ${id} not found`);
        }
        user.status = status;
        return this.userRepository.save(user);
      }),
    );

    // Invalidate cache - all affected users, list, and stats changed
    try {
      await Promise.all([
        ...ids.map((id) => this.cacheService.invalidateUser(id)),
        this.cacheService.invalidateUserList(),
        this.cacheService.invalidateUserStats(),
      ]);
    } catch (error) {
      // Cache invalidation error - log but don't fail
      this.logger.warn(
        {
          error: error instanceof Error ? error.message : String(error),
          userIds: ids,
        },
        'Error invalidating cache after bulk status update',
      );
    }

    return users.map((user) => this.mapToResponse(user));
  }

  async remove(id: string): Promise<{ message: string }> {
    this.logger.log({ userId: id }, 'Removing user');

    const user = await this.userRepository.findById(id);

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    await this.userRepository.delete(id);
    this.logger.log({ userId: id }, 'User deleted');

    // Invalidate cache - user, list, and stats changed
    try {
      await Promise.all([
        this.cacheService.invalidateUser(id),
        this.cacheService.invalidateUserList(),
        this.cacheService.invalidateUserStats(),
      ]);
      return { message: 'User deleted successfully' };
    } catch (error) {
      // Cache invalidation error - log but don't fail
      this.logger.warn(
        {
          error: error instanceof Error ? error.message : String(error),
          userId: id,
        },
        'Error invalidating cache after user deletion',
      );
      return { message: 'User deleted successfully' };
    }
  }

  async getStats(): Promise<UserStatsDto> {
    this.logger.debug('Getting user stats');

    // Try to get from cache
    try {
      const cached = await this.cacheService.getUserStats();
      if (cached) {
        return cached;
      }
    } catch (error) {
      // Cache error - fallback to database
      this.logger.warn(
        { error: error instanceof Error ? error.message : String(error) },
        'Cache error, falling back to database',
      );
    }

    const stats = await this.userRepository.getStats();

    // Cache the result
    try {
      await this.cacheService.setUserStats(stats);
    } catch (error) {
      // Cache error - continue without caching
      this.logger.warn(
        { error: error instanceof Error ? error.message : String(error) },
        'Error caching user stats',
      );
    }

    return stats;
  }

  async exportUsers(queryDto?: UserQueryDto): Promise<UserResponseDto[]> {
    this.logger.debug('Exporting users');

    try {
      // Validate credit score range (same as findAll)
      if (
        queryDto?.minCreditScore !== undefined &&
        queryDto?.maxCreditScore !== undefined &&
        queryDto.minCreditScore > queryDto.maxCreditScore
      ) {
        throw new BadRequestException(
          'minCreditScore cannot be greater than maxCreditScore',
        );
      }

      // Get all matching users without pagination
      const users = await this.userRepository.findAllForExport({
        status: queryDto?.status,
        repaymentStatus: queryDto?.repaymentStatus,
        search: queryDto?.search,
        minCreditScore: queryDto?.minCreditScore,
        maxCreditScore: queryDto?.maxCreditScore,
      });

      // Map users to response DTOs (includes effective credit limit calculation)
      return users.map((user) => this.mapToResponse(user));
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
        'Error exporting users',
      );
      throw new BadRequestException('Error exporting users');
    }
  }

  private async generateUserId(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.userRepository.countByUserIdPattern(
      `USR-${year}-%`,
    );
    const sequence = String(count + 1).padStart(3, '0');
    return `USR-${year}-${sequence}`;
  }

  private mapToResponse(user: User): UserResponseDto {
    // Calculate credit limit based on autoLimitEnabled
    let effectiveCreditLimit = Number(user.creditLimit);

    if (user.autoLimitEnabled) {
      effectiveCreditLimit = this.calculateCreditLimitByScore(user.creditScore);
    }

    return {
      id: user.id,
      userId: user.userId,
      phone: user.phone,
      email: user.email,
      creditScore: user.creditScore,
      repaymentStatus: user.repaymentStatus,
      totalRepaid: Number(user.totalRepaid),
      status: user.status,
      creditLimit: effectiveCreditLimit,
      autoLimitEnabled: user.autoLimitEnabled,
      totalLoans: user.totalLoans,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private calculateCreditLimitByScore(creditScore: number): number {
    if (creditScore < 200) {
      return 500;
    } else if (creditScore >= 200 && creditScore < 500) {
      return 1000;
    } else if (creditScore >= 500 && creditScore < 1000) {
      return 2000;
    } else {
      // creditScore >= 1000
      return 3000;
    }
  }

  async getEligibleLoanAmount(id: string): Promise<{
    eligibleAmount: number;
    creditScore: number;
    isFirstTimeUser: boolean;
  }> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    const eligibleAmount =
      await this.creditScoreService.calculateEligibleLoanAmount(user.id);

    return {
      eligibleAmount,
      creditScore: user.creditScore,
      isFirstTimeUser: !user.totalLoans || user.totalLoans === 0,
    };
  }

  async getCreditScoreHistory(id: string) {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return this.creditScoreService.getCreditScoreHistory(user.id);
  }
}
