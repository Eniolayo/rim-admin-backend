import {
  Injectable,
  Logger,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AdminInvitation,
  AdminInvitationStatus,
} from '../../../entities/admin-invitation.entity';

@Injectable()
export class InvitationRepository {
  private readonly logger = new Logger(InvitationRepository.name);

  constructor(
    @InjectRepository(AdminInvitation)
    private readonly repository: Repository<AdminInvitation>,
  ) {}

  async create(invitation: AdminInvitation): Promise<AdminInvitation> {
    try {
      this.logger.debug(`Creating invitation for email: ${invitation.email}`);
      const saved = await this.repository.save(invitation);
      this.logger.debug(`Successfully created invitation: ${saved.id}`);
      return saved;
    } catch (error) {
      this.logger.error(
        `Error creating invitation: ${error.message}`,
        error.stack,
      );
      if (error.code === '23505') {
        throw new InternalServerErrorException(
          'Database constraint violation - duplicate token or email',
        );
      }
      throw new InternalServerErrorException('Failed to create invitation');
    }
  }

  async findById(id: string): Promise<AdminInvitation | null> {
    try {
      this.logger.debug(`Finding invitation by id: ${id}`);
      const invitation = await this.repository.findOne({
        where: { id },
        relations: ['inviter'],
      });
      return invitation;
    } catch (error) {
      this.logger.error(
        `Error finding invitation by id: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('Failed to retrieve invitation');
    }
  }

  async findByToken(token: string): Promise<AdminInvitation | null> {
    try {
      this.logger.debug(`Finding invitation by token`);
      const invitation = await this.repository.findOne({
        where: { inviteToken: token },
        relations: ['inviter'],
      });
      return invitation;
    } catch (error) {
      this.logger.error(
        `Error finding invitation by token: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('Failed to retrieve invitation');
    }
  }

  async findByEmail(
    email: string,
    status?: AdminInvitationStatus,
  ): Promise<AdminInvitation | null> {
    try {
      this.logger.debug(`Finding invitation by email: ${email}`);
      const where: any = { email };
      if (status) {
        where.status = status;
      }
      const invitation = await this.repository.findOne({
        where,
        relations: ['inviter'],
      });
      return invitation;
    } catch (error) {
      this.logger.error(
        `Error finding invitation by email: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('Failed to retrieve invitation');
    }
  }

  async findAll(): Promise<AdminInvitation[]> {
    try {
      this.logger.debug('Finding all invitations');
      const invitations = await this.repository.find({
        relations: ['inviter'],
        order: { createdAt: 'DESC' },
      });
      this.logger.debug(`Found ${invitations.length} invitations`);
      return invitations;
    } catch (error) {
      this.logger.error(
        `Error finding all invitations: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('Failed to retrieve invitations');
    }
  }

  async update(
    id: string,
    data: Partial<AdminInvitation>,
  ): Promise<AdminInvitation> {
    try {
      this.logger.debug(`Updating invitation: ${id}`);
      await this.repository.update(id, data);
      const updated = await this.findById(id);
      if (!updated) {
        throw new NotFoundException(`Invitation with id ${id} not found`);
      }
      this.logger.debug(`Successfully updated invitation: ${id}`);
      return updated;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(
        `Error updating invitation: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('Failed to update invitation');
    }
  }

  async delete(id: string): Promise<void> {
    try {
      this.logger.debug(`Deleting invitation: ${id}`);
      const result = await this.repository.delete(id);
      if (result.affected === 0) {
        this.logger.warn(`No invitation found with id: ${id}`);
        throw new NotFoundException(`Invitation with id ${id} not found`);
      }
      this.logger.debug(`Successfully deleted invitation: ${id}`);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(
        `Error deleting invitation: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('Failed to delete invitation');
    }
  }

  async findExpiredPending(): Promise<AdminInvitation[]> {
    try {
      this.logger.debug('Finding expired pending invitations');
      const now = new Date();
      const invitations = await this.repository
        .createQueryBuilder('invitation')
        .where('invitation.status = :status', {
          status: AdminInvitationStatus.PENDING,
        })
        .andWhere('invitation.expiresAt < :now', { now })
        .getMany();
      this.logger.debug(`Found ${invitations.length} expired invitations`);
      return invitations;
    } catch (error) {
      this.logger.error(
        `Error finding expired invitations: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Failed to retrieve expired invitations',
      );
    }
  }
}

