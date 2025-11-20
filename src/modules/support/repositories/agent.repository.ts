import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { SupportAgent } from '../../../entities/support-agent.entity'

@Injectable()
export class AgentRepository {
  constructor(
    @InjectRepository(SupportAgent)
    private readonly repository: Repository<SupportAgent>,
  ) {}

  async findAll(): Promise<SupportAgent[]> {
    return this.repository.find()
  }

  async findById(id: string): Promise<SupportAgent | null> {
    return this.repository.findOne({ where: { id } })
  }

  async findByEmail(email: string): Promise<SupportAgent | null> {
    return this.repository.findOne({ 
      where: { email },
      relations: ['adminUser']
    })
  }

  async findByAdminUserId(adminUserId: string): Promise<SupportAgent | null> {
    return this.repository.findOne({ 
      where: { adminUserId },
      relations: ['adminUser']
    })
  }

  async findByAdminUserIds(adminUserIds: string[]): Promise<SupportAgent[]> {
    return this.repository.find({ 
      where: adminUserIds.map(id => ({ adminUserId: id })),
      relations: ['adminUser']
    })
  }

  async save(agent: SupportAgent): Promise<SupportAgent> {
    return this.repository.save(agent)
  }
}

