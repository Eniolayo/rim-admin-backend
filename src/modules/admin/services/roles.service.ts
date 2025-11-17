import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AdminRole } from '../../../entities/admin-role.entity';
import { AdminRoleRepository } from '../repositories/role.repository';
import { AdminMgmtUserRepository } from '../repositories/user.repository';
import { CreateRoleDto, RoleResponseDto, UpdateRoleDto } from '../dto/role.dto';

@Injectable()
export class RolesService {
  constructor(
    private readonly roles: AdminRoleRepository,
    private readonly users: AdminMgmtUserRepository,
  ) {}

  private toDto(role: AdminRole): RoleResponseDto {
    return {
      id: role.id,
      name: role.name,
      description: role.description,
      permissions: role.permissions as any,
      userCount: role.userCount,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    };
  }

  async list(): Promise<RoleResponseDto[]> {
    const all = await this.roles.findAll();
    // Recalculate userCount for all roles to ensure accuracy
    const rolesWithCounts = await Promise.all(
      all.map(async (role) => {
        const count = await this.users.countByRole(role.id);
        role.userCount = count;
        // Update the database to keep it in sync
        await this.roles.save(role);
        return role;
      }),
    );
    return rolesWithCounts.map((r) => this.toDto(r));
  }

  async get(id: string): Promise<RoleResponseDto> {
    const role = await this.roles.findById(id);
    if (!role) throw new NotFoundException('Role not found');
    // Recalculate userCount to ensure accuracy
    role.userCount = await this.users.countByRole(role.id);
    await this.roles.save(role);
    return this.toDto(role);
  }

  async create(dto: CreateRoleDto): Promise<RoleResponseDto> {
    const nameTaken = await this.roles.isNameTaken(dto.name);
    if (nameTaken) throw new BadRequestException('Role name already exists');
    const role = new AdminRole();
    role.name = dto.name;
    role.description = dto.description;
    role.permissions = dto.permissions as any;
    role.userCount = 0;
    const saved = await this.roles.save(role);
    return this.toDto(saved);
  }

  async update(id: string, dto: UpdateRoleDto): Promise<RoleResponseDto> {
    const role = await this.roles.findById(id);
    if (!role) throw new NotFoundException('Role not found');
    if (dto.name && (await this.roles.isNameTaken(dto.name, id))) {
      throw new BadRequestException('Role name already exists');
    }
    await this.roles.update(id, {
      name: dto.name ?? role.name,
      description: dto.description ?? role.description,
      permissions: dto.permissions ?? role.permissions,
    });
    const updated = await this.roles.findById(id);
    if (!updated) throw new NotFoundException('Role not found');
    // Recalculate userCount
    updated.userCount = await this.users.countByRole(updated.id);
    await this.roles.save(updated);
    return this.toDto(updated);
  }

  async remove(id: string): Promise<void> {
    const role = await this.roles.findById(id);
    if (!role) throw new NotFoundException('Role not found');
    const assigned = await this.users.countByRole(id);
    if (assigned > 0)
      throw new BadRequestException('Cannot delete role with assigned users');
    await this.roles.delete(id);
  }
}
