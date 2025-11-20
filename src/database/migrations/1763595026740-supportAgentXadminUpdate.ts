import { MigrationInterface, QueryRunner } from "typeorm";

export class SupportAgentXadminUpdate1763595026740 implements MigrationInterface {
    name = 'SupportAgentXadminUpdate1763595026740'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_0976cfb2b34ec228171f47b2e9"`);
        await queryRunner.query(`ALTER TABLE "ADMIN_ROLES" ADD "departmentId" uuid`);
        await queryRunner.query(`ALTER TABLE "SUPPORT_AGENTS" ADD "adminUserId" uuid NOT NULL`);
        await queryRunner.query(`ALTER TABLE "SUPPORT_AGENTS" DROP CONSTRAINT "UQ_0976cfb2b34ec228171f47b2e92"`);
        await queryRunner.query(`CREATE INDEX "IDX_20f517f2c9cdcecb7e84709adc" ON "SUPPORT_AGENTS" ("adminUserId") `);
        await queryRunner.query(`ALTER TABLE "ADMIN_ROLES" ADD CONSTRAINT "FK_ffdb4349e0850aa92c8de112ed5" FOREIGN KEY ("departmentId") REFERENCES "DEPARTMENTS"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "SUPPORT_AGENTS" ADD CONSTRAINT "FK_20f517f2c9cdcecb7e84709adcb" FOREIGN KEY ("adminUserId") REFERENCES "ADMIN_USERS"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "SUPPORT_AGENTS" DROP CONSTRAINT "FK_20f517f2c9cdcecb7e84709adcb"`);
        await queryRunner.query(`ALTER TABLE "ADMIN_ROLES" DROP CONSTRAINT "FK_ffdb4349e0850aa92c8de112ed5"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_20f517f2c9cdcecb7e84709adc"`);
        await queryRunner.query(`ALTER TABLE "SUPPORT_AGENTS" ADD CONSTRAINT "UQ_0976cfb2b34ec228171f47b2e92" UNIQUE ("email")`);
        await queryRunner.query(`ALTER TABLE "SUPPORT_AGENTS" DROP COLUMN "adminUserId"`);
        await queryRunner.query(`ALTER TABLE "ADMIN_ROLES" DROP COLUMN "departmentId"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_0976cfb2b34ec228171f47b2e9" ON "SUPPORT_AGENTS" ("email") `);
    }

}
