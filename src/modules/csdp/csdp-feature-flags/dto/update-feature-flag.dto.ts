import { IsNotEmpty } from 'class-validator';

export class UpdateFeatureFlagDto {
  @IsNotEmpty()
  value: unknown;
}
