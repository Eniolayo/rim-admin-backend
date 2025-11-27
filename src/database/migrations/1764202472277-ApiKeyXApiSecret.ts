import { MigrationInterface, QueryRunner } from "typeorm";

export class ApiKeyXApiSecret1764202472277 implements MigrationInterface {
    name = 'ApiKeyXApiSecret1764202472277'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."API_KEYS_status_enum" AS ENUM('active', 'inactive', 'revoked')`);
        await queryRunner.query(`CREATE TABLE "API_KEYS" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tokenPrefix" character varying(8) NOT NULL, "tokenHash" character varying(255) NOT NULL, "name" character varying(255) NOT NULL, "email" character varying(255) NOT NULL, "description" text, "status" "public"."API_KEYS_status_enum" NOT NULL DEFAULT 'active', "lastUsedAt" TIMESTAMP, "expiresAt" TIMESTAMP NOT NULL, "createdBy" uuid NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_d5f95565b83a1a6f12fe8a878d7" UNIQUE ("tokenPrefix"), CONSTRAINT "UQ_9ece6f2612465b9085915f3181a" UNIQUE ("email"), CONSTRAINT "PK_788b12ad3181202d1093d658a87" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_0c18521fc1ab359885244c8f1f" ON "API_KEYS" ("createdBy") `);
        await queryRunner.query(`CREATE INDEX "IDX_4257b3a5671547bc208ef13e7d" ON "API_KEYS" ("status") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_9ece6f2612465b9085915f3181" ON "API_KEYS" ("email") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_d5f95565b83a1a6f12fe8a878d" ON "API_KEYS" ("tokenPrefix") `);
        await queryRunner.query(`ALTER TABLE "API_KEYS" ADD CONSTRAINT "FK_0c18521fc1ab359885244c8f1f7" FOREIGN KEY ("createdBy") REFERENCES "ADMIN_USERS"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "API_KEYS" DROP CONSTRAINT "FK_0c18521fc1ab359885244c8f1f7"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d5f95565b83a1a6f12fe8a878d"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9ece6f2612465b9085915f3181"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_4257b3a5671547bc208ef13e7d"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0c18521fc1ab359885244c8f1f"`);
        await queryRunner.query(`DROP TABLE "API_KEYS"`);
        await queryRunner.query(`DROP TYPE "public"."API_KEYS_status_enum"`);
    }

}
