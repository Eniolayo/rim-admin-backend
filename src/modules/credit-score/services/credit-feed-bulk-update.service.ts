import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Logger } from 'nestjs-pino';
import { User } from '../../../entities/user.entity';
import { CreditFeedRecord } from './credit-feed-parser.service';
import { UsersCacheService } from '../../users/services/users-cache.service';

@Injectable()
export class CreditFeedBulkUpdateService {
  private readonly batchSize: number;

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly usersCacheService: UsersCacheService,
    private readonly logger: Logger,
  ) {
    // Batch size for bulk updates (configurable via env)
    this.batchSize =
      parseInt(process.env.CREDIT_FEED_PROCESSING_BATCH_SIZE || '1000', 10) ||
      1000;
  }

  /**
   * Bulk update credit scores from feed records
   */
  async bulkUpdateCreditScores(
    records: CreditFeedRecord[],
  ): Promise<{ processed: number; errors: number }> {
    this.logger.log(
      { recordCount: records.length, batchSize: this.batchSize },
      'Starting bulk credit score update',
    );

    let processed = 0;
    let errors = 0;

    // Process in batches
    for (let i = 0; i < records.length; i += this.batchSize) {
      const batch = records.slice(i, i + this.batchSize);

      try {
        const result = await this.processBatch(batch);
        processed += result.processed;
        errors += result.errors;

        this.logger.debug(
          {
            batchStart: i,
            batchEnd: i + batch.length,
            batchProcessed: result.processed,
            batchErrors: result.errors,
          },
          'Batch processed',
        );
      } catch (error) {
        this.logger.error(
          {
            batchStart: i,
            batchEnd: i + batch.length,
            error: error instanceof Error ? error.message : String(error),
          },
          'Error processing batch',
        );
        errors += batch.length;
      }
    }

    this.logger.log(
      { processed, errors, totalRecords: records.length },
      'Bulk credit score update completed',
    );

    return { processed, errors };
  }

  /**
   * Process a batch of records
   */
  private async processBatch(
    batch: CreditFeedRecord[],
  ): Promise<{ processed: number; errors: number }> {
    let processed = 0;
    let errors = 0;

    // Extract phone numbers
    const phoneNumbers = batch.map((r) => r.phoneNumber);

    // Fetch users by phone numbers
    const users = await this.userRepository.find({
      where: { phone: In(phoneNumbers) },
    });

    // Create a map for quick lookup
    const userMap = new Map<string, User>();
    for (const user of users) {
      userMap.set(user.phone, user);
    }

    // Prepare updates
    const updates: Array<{ user: User; newScore: number }> = [];

    for (const record of batch) {
      try {
        const user = userMap.get(record.phoneNumber);

        if (!user) {
          this.logger.debug(
            { phoneNumber: record.phoneNumber },
            'User not found for phone number',
          );
          errors++;
          continue;
        }

        let newScore: number;

        // Handle absolute credit score
        if (record.creditScore !== undefined) {
          newScore = record.creditScore;
        }
        // Handle score update (delta)
        else if (record.scoreUpdate !== undefined) {
          newScore = user.creditScore + record.scoreUpdate;
        } else {
          this.logger.warn(
            { phoneNumber: record.phoneNumber },
            'Record has neither creditScore nor scoreUpdate',
          );
          errors++;
          continue;
        }

        // Clamp score to valid range (0-1000)
        newScore = Math.max(0, Math.min(1000, newScore));

        // Only update if score changed
        if (newScore !== user.creditScore) {
          updates.push({ user, newScore });
        }

        processed++;
      } catch (error) {
        this.logger.error(
          {
            phoneNumber: record.phoneNumber,
            error: error instanceof Error ? error.message : String(error),
          },
          'Error processing record',
        );
        errors++;
      }
    }

    // Perform bulk update using TypeORM query builder
    if (updates.length > 0) {
      await this.performBulkUpdate(updates);
    }

    return { processed, errors };
  }

  /**
   * Perform bulk database update
   */
  private async performBulkUpdate(
    updates: Array<{ user: User; newScore: number }>,
  ): Promise<void> {
    // Use CASE WHEN for efficient bulk update
    const userIds = updates.map((u) => u.user.id);
    const caseStatements = updates
      .map((u, index) => `WHEN '${u.user.id}' THEN ${u.newScore}`)
      .join(' ');

    await this.userRepository
      .createQueryBuilder()
      .update(User)
      .set({
        creditScore: () =>
          `CASE id ${caseStatements} ELSE "creditScore" END`,
      })
      .whereInIds(userIds)
      .execute();

    // Invalidate cache for updated users
    const invalidationPromises = updates.map((u) =>
      this.usersCacheService.invalidateUserCache(u.user.id).catch((error) => {
        this.logger.warn(
          {
            userId: u.user.id,
            error: error instanceof Error ? error.message : String(error),
          },
          'Error invalidating user cache',
        );
      }),
    );

    await Promise.all(invalidationPromises);

    this.logger.debug(
      { updateCount: updates.length },
      'Bulk credit score update executed',
    );
  }
}




