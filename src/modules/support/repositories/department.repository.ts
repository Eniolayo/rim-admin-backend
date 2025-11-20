import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Department } from '../../../entities/department.entity'

@Injectable()
export class DepartmentRepository {
  private readonly logger = new Logger(DepartmentRepository.name)

  constructor(
    @InjectRepository(Department)
    private readonly repository: Repository<Department>,
  ) {}

  async findAll(): Promise<Department[]> {
    return this.repository.find()
  }

  async findById(id: string): Promise<Department | null> {
    this.logger.log(`Finding department by id ${id}`)
    const department = await this.repository.findOne({ where: { id } })
    if (department) {
      this.logger.log(`Department found with id ${id} and name ${department.name}`)
    } else {
      this.logger.log(`Department not found with id ${id}`)
    }
    return department
  }

  async save(department: Department): Promise<Department> {
    this.logger.log(`Saving department with name ${department.name} and id ${department.id}`)
    const saved = await this.repository.save(department)
    this.logger.log(`Department saved successfully with id ${saved.id} and name ${saved.name}`)
    return saved
  }

  async update(id: string, patch: Partial<Department>): Promise<void> {
    this.logger.log(`Updating department with id ${id} with patch ${JSON.stringify(patch)}`)
    await this.repository.update(id, patch as any)
    this.logger.log(`Department updated successfully with id ${id}`)
  }

  async delete(id: string): Promise<void> {
    this.logger.log(`Deleting department with id ${id}`)
    await this.repository.delete(id)
    this.logger.log(`Department deleted successfully with id ${id}`)
  }

  async remove(department: Department): Promise<void> {
    this.logger.log(`Removing department with id ${department.id} and name ${department.name}`)
    await this.repository.remove(department)
    this.logger.log(`Department removed successfully with id ${department.id}`)
  }
}

