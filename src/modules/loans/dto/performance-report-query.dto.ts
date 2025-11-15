import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsDateString } from 'class-validator';

export class PerformanceReportQueryDto {
  @ApiProperty({
    description: 'Start date for the report (ISO date string, YYYY-MM-DD)',
    example: '2024-01-01',
  })
  @IsString()
  @IsDateString()
  startDate: string;

  @ApiProperty({
    description: 'End date for the report (ISO date string, YYYY-MM-DD)',
    example: '2024-12-31',
  })
  @IsString()
  @IsDateString()
  endDate: string;
}

