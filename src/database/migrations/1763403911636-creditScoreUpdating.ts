import { MigrationInterface, QueryRunner } from "typeorm";

export class CreditScoreUpdating1763403911636 implements MigrationInterface {
    name = 'CreditScoreUpdating1763403911636'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "CREDIT_SCORE_HISTORY" ADD "metadata" jsonb`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "CREDIT_SCORE_HISTORY" DROP COLUMN "metadata"`);
    }

}
