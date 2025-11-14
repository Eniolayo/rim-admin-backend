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
}

