import { ApiProperty } from '@nestjs/swagger'
import { IsString, IsNotEmpty, IsInt, Min, IsOptional } from 'class-validator'

export class CreateDepartmentDto {
  @ApiProperty({ description: 'Department name', example: 'Technical Support' })
  @IsString()
  @IsNotEmpty()
  name: string

  @ApiProperty({ description: 'Department description', example: 'Technical issues and app problems' })
  @IsString()
  @IsNotEmpty()
  description: string

  @ApiProperty({ description: 'Support tier level', example: 1, minimum: 1 })
  @IsInt()
  @Min(1)
  tier: number
}

export class UpdateDepartmentDto {
  @ApiProperty({ description: 'Department name', example: 'Technical Support', required: false })
  @IsString()
  @IsOptional()
  name?: string

  @ApiProperty({ description: 'Department description', example: 'Technical issues and app problems', required: false })
  @IsString()
  @IsOptional()
  description?: string

  @ApiProperty({ description: 'Support tier level', example: 1, minimum: 1, required: false })
  @IsInt()
  @Min(1)
  @IsOptional()
  tier?: number
}

