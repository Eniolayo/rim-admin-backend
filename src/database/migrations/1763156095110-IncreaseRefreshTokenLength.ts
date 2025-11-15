import { MigrationInterface, QueryRunner } from "typeorm";

export class IncreaseRefreshTokenLength1763156095110 implements MigrationInterface {
    name = 'IncreaseRefreshTokenLength1763156095110'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ADMIN_USERS" DROP COLUMN "refreshToken"`);
        await queryRunner.query(`ALTER TABLE "ADMIN_USERS" ADD "refreshToken" text`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ADMIN_USERS" DROP COLUMN "refreshToken"`);
        await queryRunner.query(`ALTER TABLE "ADMIN_USERS" ADD "refreshToken" character varying(255)`);
    }

}
