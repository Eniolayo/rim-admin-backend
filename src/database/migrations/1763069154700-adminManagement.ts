import { MigrationInterface, QueryRunner } from "typeorm";

export class AdminManagement1763069154700 implements MigrationInterface {
    name = 'AdminManagement1763069154700'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "ADMIN_ACTIVITY_LOGS" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "adminId" uuid NOT NULL, "adminName" character varying(255) NOT NULL, "action" character varying(255) NOT NULL, "resource" character varying(255) NOT NULL, "resourceId" character varying(255), "details" jsonb, "ipAddress" character varying(255), "timestamp" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_e5345175128c0490b465119cdad" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_0e6cca6ce0c2f4eb228d4e8b03" ON "ADMIN_ACTIVITY_LOGS" ("timestamp") `);
        await queryRunner.query(`CREATE INDEX "IDX_e8ff605ece41d81e5ae5318a8a" ON "ADMIN_ACTIVITY_LOGS" ("resource") `);
        await queryRunner.query(`CREATE INDEX "IDX_f4c4d0c60db1cba1c90211fbb1" ON "ADMIN_ACTIVITY_LOGS" ("adminId") `);
        await queryRunner.query(`CREATE TYPE "public"."SECURITY_SETTINGS_method_enum" AS ENUM('sms', 'email', 'app')`);
        await queryRunner.query(`CREATE TABLE "SECURITY_SETTINGS" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "enabled" boolean NOT NULL DEFAULT true, "requiredForAdmins" boolean NOT NULL DEFAULT false, "method" "public"."SECURITY_SETTINGS_method_enum" NOT NULL DEFAULT 'sms', "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedBy" uuid, CONSTRAINT "PK_05eb6e4169d5bd77fe09da0c9d6" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "ADMIN_ACTIVITY_LOGS" ADD CONSTRAINT "FK_f4c4d0c60db1cba1c90211fbb14" FOREIGN KEY ("adminId") REFERENCES "ADMIN_USERS"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "SECURITY_SETTINGS" ADD CONSTRAINT "FK_54adcb58e8228c6021d62d552c6" FOREIGN KEY ("updatedBy") REFERENCES "ADMIN_USERS"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "SECURITY_SETTINGS" DROP CONSTRAINT "FK_54adcb58e8228c6021d62d552c6"`);
        await queryRunner.query(`ALTER TABLE "ADMIN_ACTIVITY_LOGS" DROP CONSTRAINT "FK_f4c4d0c60db1cba1c90211fbb14"`);
        await queryRunner.query(`DROP TABLE "SECURITY_SETTINGS"`);
        await queryRunner.query(`DROP TYPE "public"."SECURITY_SETTINGS_method_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f4c4d0c60db1cba1c90211fbb1"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e8ff605ece41d81e5ae5318a8a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0e6cca6ce0c2f4eb228d4e8b03"`);
        await queryRunner.query(`DROP TABLE "ADMIN_ACTIVITY_LOGS"`);
    }

}
