import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiKey } from '../../entities/api-key.entity';
import { AdminUser } from '../../entities/admin-user.entity';
import { AdminRole } from '../../entities/admin-role.entity';
import { ApiKeyService } from './services/api-key.service';
import { ApiKeyGuard } from './guards/api-key.guard';

@Module({
  imports: [TypeOrmModule.forFeature([ApiKey, AdminUser, AdminRole])],
  providers: [ApiKeyService, ApiKeyGuard],
  exports: [ApiKeyService, ApiKeyGuard],
})
export class ApiKeyModule {}

