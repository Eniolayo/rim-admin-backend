import {
  IsString,
  IsEmail,
  IsOptional,
  IsNumber,
  IsEnum,
  IsBoolean,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { UserStatus, RepaymentStatus } from '../../../entities/user.entity';

export class UpdateUserDto {
  @ApiPropertyOptional({ description: 'User phone number' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ description: 'User email address' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ description: 'Credit score' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  creditScore?: number;

  @ApiPropertyOptional({ description: 'Credit limit' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  creditLimit?: number;

  @ApiPropertyOptional({ description: 'Auto limit enabled' })
  @IsBoolean()
  @IsOptional()
  autoLimitEnabled?: boolean;

  @ApiPropertyOptional({ description: 'User status', enum: UserStatus })
  @IsEnum(UserStatus)
  @IsOptional()
  status?: UserStatus;

  @ApiPropertyOptional({
    description: 'Repayment status',
    enum: RepaymentStatus,
  })
  @IsEnum(RepaymentStatus)
  @IsOptional()
  repaymentStatus?: RepaymentStatus;
}
