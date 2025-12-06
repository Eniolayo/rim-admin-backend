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
import { normalizeNigerianPhone } from '../../../common/utils/phone.utils';

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
    this.logger.log(`Creating new user with phone: ${createUserDto.phone}`);

    // Normalize phone number to ensure consistent format
    const normalizedPhone = normalizeNigerianPhone(createUserDto.phone);
    if (!normalizedPhone) {
      throw new BadRequestException(
        `Invalid phone number format: "${createUserDto.phone}"`,
      );
    }

    this.logger.log(
      `Normalized phone from "${createUserDto.phone}" to "${normalizedPhone}"`,
    );

    // Check if a user with this phone number already exists (using normalized phone)
    const existingUser = await this.userRepository.findByPhone(normalizedPhone);
    if (existingUser) {
      this.logger.warn(
        { phone: normalizedPhone, existingUserId: existingUser.userId },
        'Attempted to create user with duplicate phone number',
      );
      throw new BadRequestException(
        `A user with phone number "${normalizedPhone}" already exists. Phone numbers must be unique.`,
      );
    }

    // Generate userId
    const userId = await this.generateUserId();
    this.logger.log(`Generated userId: ${userId}`);
    this.logger.log(`Creating user with normalized phone: ${normalizedPhone}`);

    // Get first-time user default credit score from system config
    let creditScore = 0;
    try {
      creditScore = await this.systemConfigService.getValue<number>(
        'credit_score',
        'first_timer_default_score',
        0,
      );
      this.logger.debug(
        `Using first-time user default credit score: ${creditScore}`,
      );
    } catch (error) {
      this.logger.warn(
        `Error getting first_timer_default_score, using default 0: ${error instanceof Error ? error.message : String(error)}`,
      );
      creditScore = 0;
    }

    // Clamp to maximum allowed credit score from system config
    try {
      const maxScore = await this.systemConfigService.getValue<number>(
        'credit_score',
        'max_score',
        1000,
      );
      if (creditScore > maxScore) {
        this.logger.debug(
          { creditScore, maxScore },
          'Clamping initial credit score to max_score',
        );
        creditScore = maxScore;
      }
    } catch (error) {
      this.logger.warn(
        {
          error: error instanceof Error ? error.message : String(error),
        },
        'Error getting max_score, using default clamp 1000',
      );
      if (creditScore > 1000) {
        creditScore = 1000;
      }
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
        `Calculated credit limit from thresholds: ${creditScore} -> ${creditLimit}`,
      );
    } catch (error) {
      this.logger.warn(
        `Error getting thresholds, using default 0: ${error instanceof Error ? error.message : String(error)}`,
      );
      creditLimit = 0;
    }

    const UserIdIsNotUnique = await this.userRepository.findByUserId(userId);
    if (UserIdIsNotUnique) {
      throw new BadRequestException(
        `User ID ${userId} is not unique. Please try again.`,
      );
    }
    this.logger.log(`User ID is not unique: ${userId}`);

    const user = this.repository.create({
      ...createUserDto,
      phone: normalizedPhone, // Use normalized phone number
      userId,
      creditScore, // Use auto-calculated value, ignore if provided in DTO
      creditLimit, // Use auto-calculated value, ignore if provided in DTO
      autoLimitEnabled: createUserDto.autoLimitEnabled ?? false,
      status: createUserDto.status ?? UserStatus.ACTIVE,
      repaymentStatus: RepaymentStatus.COMPLETED, // New users always start with Completed status
      totalRepaid: 0,
      totalLoans: 0,
    });

    this.logger.log(`User created: ${JSON.stringify(user)}`);

    const savedUser = await this.userRepository.save(user);
    this.logger.log(`User saved: ${JSON.stringify(savedUser)}`);

    // Invalidate cache - list and stats changed
    try {
      await Promise.all([
        this.cacheService.invalidateUserList(),
        this.cacheService.invalidateUserStats(),
      ]);
    } catch (error) {
      // Cache invalidation error - log but don't fail
      this.logger.warn(
        `Error invalidating cache after user creation: ${error instanceof Error ? error.message : String(error)}`,
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
          `Cache error, falling back to database: ${error instanceof Error ? error.message : String(error)}`,
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
            `Error caching user list: ${error instanceof Error ? error.message : String(error)}`,
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
          `Error caching user list: ${error instanceof Error ? error.message : String(error)}`,
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
      throw new BadRequestException(
        'User ID is required and must be a non-empty string',
      );
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
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
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

    // If enabling auto-limit, calculate based on credit score using the same logic as eligible loan amount
    if (autoLimitEnabled === true) {
      const calculatedLimit = await this.calculateCreditLimitByScore(
        user.id,
        user.creditScore,
      );
      user.creditLimit = calculatedLimit;
      user.autoLimitEnabled = true;
      this.logger.log(
        {
          userId: user.id,
          creditScore: user.creditScore,
          calculatedCreditLimit: calculatedLimit,
        },
        'Auto-calculated credit limit based on credit score',
      );
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
    const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excludes 0, O, I, 1 for clarity
    let suffix = '';
    for (let i = 0; i < 6; i++) {
      suffix += characters.charAt(
        Math.floor(Math.random() * characters.length),
      );
    }

    const userId = `USR-${suffix}`;

    // Ensure uniqueness
    const exists = await this.userRepository.findByUserId(userId);
    if (exists) {
      // Retry if collision (very rare)
      return this.generateUserId();
    }

    return userId;
  }

  private mapToResponse(user: User): UserResponseDto {
    // Return the stored credit limit
    // If autoLimitEnabled is true, the credit limit should already be synced in the database
    const effectiveCreditLimit = Number(user.creditLimit);

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

  /**
   * Calculate credit limit based on credit score using the same logic as eligible loan amount
   * This ensures credit limit and eligible loan amount are always in sync
   */
  private async calculateCreditLimitByScore(
    userId: string,
    creditScore: number,
  ): Promise<number> {
    // Use the same calculation as eligible loan amount to ensure consistency
    return this.creditScoreService.calculateEligibleLoanAmount(userId);
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

  async getCalculatedInterestRate(id: string): Promise<{
    interestRate: number;
    creditScore: number;
  }> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    const interestRate =
      await this.creditScoreService.calculateInterestRateByCreditScore(user.id);

    return {
      interestRate,
      creditScore: user.creditScore,
    };
  }

  async getCalculatedRepaymentPeriod(id: string): Promise<{
    repaymentPeriod: number;
    creditScore: number;
  }> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    const repaymentPeriod =
      await this.creditScoreService.calculateRepaymentPeriodByCreditScore(
        user.id,
      );

    return {
      repaymentPeriod,
      creditScore: user.creditScore,
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
