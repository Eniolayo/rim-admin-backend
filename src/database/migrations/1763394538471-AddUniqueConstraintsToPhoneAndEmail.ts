import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUniqueConstraintsToPhoneAndEmail1763394538471 implements MigrationInterface {
    name = 'AddUniqueConstraintsToPhoneAndEmail1763394538471'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_a1689164dbbcca860ce6d17b2e"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_16348a64640625de02abc838e3"`);
        await queryRunner.query(`ALTER TABLE "LOANS" ALTER COLUMN "disbursedAmount" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "USERS" ADD CONSTRAINT "UQ_16348a64640625de02abc838e35" UNIQUE ("phone")`);
        await queryRunner.query(`ALTER TABLE "USERS" ADD CONSTRAINT "UQ_a1689164dbbcca860ce6d17b2e1" UNIQUE ("email")`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_a1689164dbbcca860ce6d17b2e" ON "USERS" ("email") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_16348a64640625de02abc838e3" ON "USERS" ("phone") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_16348a64640625de02abc838e3"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a1689164dbbcca860ce6d17b2e"`);
        await queryRunner.query(`ALTER TABLE "USERS" DROP CONSTRAINT "UQ_a1689164dbbcca860ce6d17b2e1"`);
        await queryRunner.query(`ALTER TABLE "USERS" DROP CONSTRAINT "UQ_16348a64640625de02abc838e35"`);
        await queryRunner.query(`ALTER TABLE "LOANS" ALTER COLUMN "disbursedAmount" SET DEFAULT '0'`);
        await queryRunner.query(`CREATE INDEX "IDX_16348a64640625de02abc838e3" ON "USERS" ("phone") `);
        await queryRunner.query(`CREATE INDEX "IDX_a1689164dbbcca860ce6d17b2e" ON "USERS" ("email") `);
    }

}
