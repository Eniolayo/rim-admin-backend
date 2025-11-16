import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDisbursedAmountToLoans1763297434352
  implements MigrationInterface
{
  name = 'AddDisbursedAmountToLoans1763297434352';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add disbursedAmount column
    await queryRunner.query(
      `ALTER TABLE "LOANS" ADD "disbursedAmount" numeric(15,2) NOT NULL DEFAULT 0`,
    );

    // Calculate disbursedAmount for existing loans (amount - interest)
    // disbursedAmount = amount - (amount * interestRate / 100)
    await queryRunner.query(`
            UPDATE "LOANS" 
            SET "disbursedAmount" = "amount" - ("amount" * "interestRate" / 100)
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "LOANS" DROP COLUMN "disbursedAmount"`,
    );
  }
}
