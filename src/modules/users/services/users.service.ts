import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { UserRepository } from '../repositories/user.repository';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CreateUserDto,
  UpdateUserDto,
  UserResponseDto,
  UserStatsDto,
} from '../dto';
import {
  User,
  UserStatus,
  RepaymentStatus,
} from '../../../entities/user.entity';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly userRepository: UserRepository,
    @InjectRepository(User)
    private readonly repository: Repository<User>,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<UserResponseDto> {
    this.logger.log('Creating new user');

    // Generate userId
    const userId = await this.generateUserId();

    const user = this.repository.create({
      ...createUserDto,
      userId,
      creditScore: createUserDto.creditScore ?? 0,
      creditLimit: createUserDto.creditLimit ?? 0,
      autoLimitEnabled: createUserDto.autoLimitEnabled ?? false,
      status: createUserDto.status ?? UserStatus.ACTIVE,
      repaymentStatus: createUserDto.repaymentStatus ?? RepaymentStatus.PENDING,
      totalRepaid: 0,
      totalLoans: 0,
    });

    const savedUser = await this.userRepository.save(user);
    this.logger.log(`User created: ${savedUser.userId}`);

    return this.mapToResponse(savedUser);
  }

  async findAll(filters?: {
    status?: string;
    repaymentStatus?: string;
    search?: string;
  }): Promise<UserResponseDto[]> {
    this.logger.debug('Finding all users');

    const users = filters
      ? await this.userRepository.findWithFilters(filters)
      : await this.userRepository.findAll();

    return users.map((user) => this.mapToResponse(user));
  }

  async findOne(id: string): Promise<UserResponseDto> {
    this.logger.debug(`Finding user: ${id}`);

    const user = await this.userRepository.findById(id);

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return this.mapToResponse(user);
  }

  async update(
    id: string,
    updateUserDto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    this.logger.log(`Updating user: ${id}`);

    const user = await this.userRepository.findById(id);

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    Object.assign(user, updateUserDto);
    const updatedUser = await this.userRepository.save(user);

    this.logger.log(`User updated: ${updatedUser.userId}`);

    return this.mapToResponse(updatedUser);
  }

  async updateStatus(id: string, status: UserStatus): Promise<UserResponseDto> {
    this.logger.log(`Updating user status: ${id} to ${status}`);

    const user = await this.userRepository.findById(id);

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    user.status = status;
    const updatedUser = await this.userRepository.save(user);

    return this.mapToResponse(updatedUser);
  }

  async updateCreditLimit(
    id: string,
    creditLimit: number,
    autoLimitEnabled?: boolean,
  ): Promise<UserResponseDto> {
    this.logger.log(`Updating credit limit for user: ${id}`);

    const user = await this.userRepository.findById(id);

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    user.creditLimit = creditLimit;
    if (autoLimitEnabled !== undefined) {
      user.autoLimitEnabled = autoLimitEnabled;
    }
    const updatedUser = await this.userRepository.save(user);

    return this.mapToResponse(updatedUser);
  }

  async bulkUpdateStatus(
    ids: string[],
    status: UserStatus,
  ): Promise<UserResponseDto[]> {
    this.logger.log(
      `Bulk updating status for ${ids.length} users to ${status}`,
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

    return users.map((user) => this.mapToResponse(user));
  }

  async remove(id: string): Promise<void> {
    this.logger.log(`Removing user: ${id}`);

    const user = await this.userRepository.findById(id);

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    await this.userRepository.delete(id);
  }

  async getStats(): Promise<UserStatsDto> {
    this.logger.debug('Getting user stats');

    return this.userRepository.getStats();
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
    return {
      id: user.id,
      userId: user.userId,
      phone: user.phone,
      email: user.email,
      creditScore: user.creditScore,
      repaymentStatus: user.repaymentStatus,
      totalRepaid: Number(user.totalRepaid),
      status: user.status,
      creditLimit: Number(user.creditLimit),
      autoLimitEnabled: user.autoLimitEnabled,
      totalLoans: user.totalLoans,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
