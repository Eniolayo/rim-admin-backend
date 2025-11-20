import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsNotEmpty,
  IsString,
  ArrayNotEmpty,
  ArrayMinSize,
  IsIn,
  ValidateNested,
  IsOptional,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PermissionDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  resource: string;

  @ApiProperty({ isArray: true, enum: ['read', 'write', 'delete'] })
  @IsArray()
  @ArrayNotEmpty()
  @IsIn(['read', 'write', 'delete'], { each: true })
  actions: ('read' | 'write' | 'delete')[];
}

export class CreateRoleDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ type: [PermissionDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PermissionDto)
  permissions: PermissionDto[];

  @ApiProperty({ required: false, nullable: true, description: 'Department ID (optional, for support agent roles)' })
  @IsUUID()
  @IsOptional()
  departmentId?: string | null;
}

export class UpdateRoleDto {
  @ApiProperty({ required: false })
  @IsString()
  name?: string;

  @ApiProperty({ required: false })
  @IsString()
  description?: string;

  @ApiProperty({ type: [PermissionDto], required: false })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PermissionDto)
  permissions?: PermissionDto[];

  @ApiProperty({ required: false, nullable: true, description: 'Department ID (optional, for support agent roles)' })
  @IsUUID()
  @IsOptional()
  departmentId?: string | null;
}

export class RoleResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  description: string;

  @ApiProperty({ type: [PermissionDto] })
  permissions: PermissionDto[];

  @ApiProperty()
  userCount: number;

  @ApiProperty({ required: false, nullable: true })
  departmentId?: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
