import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator';

export class UploadDto {
  @IsDateString()
  file_date: string; // YYYY-MM-DD

  @IsIn(['refill', 'sdp', 'vendor:avyra', 'vendor:erl', 'vendor:fonyou'])
  source: string;

  @IsString()
  @IsOptional()
  expected_hash?: string; // optional client-supplied SHA-256 for sanity check
}
