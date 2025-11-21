import { MigrationInterface, QueryRunner } from "typeorm";

export class ResetPasswordToken1763746793826 implements MigrationInterface {
    name = 'ResetPasswordToken1763746793826'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ADMIN_USERS" ADD "passwordResetTokenHash" character varying(255)`);
        await queryRunner.query(`ALTER TABLE "ADMIN_USERS" ADD "passwordResetTokenExpiresAt" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "ADMIN_USERS" ADD "passwordResetTokenUsedAt" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "ADMIN_USERS" ADD "lastPasswordChangedAt" TIMESTAMP`);
        await queryRunner.query(`CREATE INDEX "IDX_9241a72f493bd7b70b0c9d41ba" ON "ADMIN_USERS" ("passwordResetTokenHash") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_9241a72f493bd7b70b0c9d41ba"`);
        await queryRunner.query(`ALTER TABLE "ADMIN_USERS" DROP COLUMN "lastPasswordChangedAt"`);
        await queryRunner.query(`ALTER TABLE "ADMIN_USERS" DROP COLUMN "passwordResetTokenUsedAt"`);
        await queryRunner.query(`ALTER TABLE "ADMIN_USERS" DROP COLUMN "passwordResetTokenExpiresAt"`);
        await queryRunner.query(`ALTER TABLE "ADMIN_USERS" DROP COLUMN "passwordResetTokenHash"`);
    }

}
