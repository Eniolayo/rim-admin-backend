import {
  IsString,
  IsEmail,
  IsOptional,
  IsNumber,
  IsEnum,
  IsBoolean,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserStatus, RepaymentStatus } from '../../../entities/user.entity';

export class CreateUserDto {
  @ApiProperty({
    description: 'User phone number',
    example: '+234 801 234 5678',
  })
  @IsString()
  phone: string;

  @ApiPropertyOptional({
    description: 'User email address',
    example: 'user@example.com',
  })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({
    description: 'Credit score',
    example: 750,
    default: 0,
  })
  @IsNumber()
  @IsOptional()
  @Min(0)
  creditScore?: number;

  @ApiPropertyOptional({
    description: 'Credit limit',
    example: 50000,
    default: 0,
  })
  @IsNumber()
  @IsOptional()
  @Min(0)
  creditLimit?: number;

  @ApiPropertyOptional({
    description: 'Auto limit enabled',
    example: true,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  autoLimitEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'User status',
    enum: UserStatus,
    default: UserStatus.ACTIVE,
  })
  @IsEnum(UserStatus)
  @IsOptional()
  status?: UserStatus;

  @ApiPropertyOptional({
    description: 'Repayment status',
    enum: RepaymentStatus,
    default: RepaymentStatus.PENDING,
  })
  @IsEnum(RepaymentStatus)
  @IsOptional()
  repaymentStatus?: RepaymentStatus;
}
