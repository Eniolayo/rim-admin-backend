import { MigrationInterface, QueryRunner } from "typeorm";

export class CreditScoreSystem1763299201689 implements MigrationInterface {
    name = 'CreditScoreSystem1763299201689'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "SYSTEM_CONFIG" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "category" character varying(100) NOT NULL, "key" character varying(255) NOT NULL, "value" jsonb NOT NULL, "description" text, "updatedBy" uuid, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_ca398982b50e9d3419e184b42ab" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_e583f660cd6a5c677292f6ab3a" ON "SYSTEM_CONFIG" ("category", "key") `);
        await queryRunner.query(`CREATE INDEX "IDX_c5830db444891fafe32ecb91f9" ON "SYSTEM_CONFIG" ("category") `);
        await queryRunner.query(`CREATE TABLE "CREDIT_SCORE_HISTORY" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "previousScore" integer NOT NULL, "newScore" integer NOT NULL, "pointsAwarded" integer NOT NULL, "reason" character varying(255), "loanId" uuid, "transactionId" uuid, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_2b246e69b5cb272da04182f6481" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_b8a941d54d001ed9c499a0db33" ON "CREDIT_SCORE_HISTORY" ("createdAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_9e5c5ecc511a183539e7bd4db8" ON "CREDIT_SCORE_HISTORY" ("transactionId") `);
        await queryRunner.query(`CREATE INDEX "IDX_5f0a7d941365acc15193f1c4c7" ON "CREDIT_SCORE_HISTORY" ("loanId") `);
        await queryRunner.query(`CREATE INDEX "IDX_85381785073e48da8e8484e148" ON "CREDIT_SCORE_HISTORY" ("userId") `);
        await queryRunner.query(`ALTER TABLE "TRANSACTIONS" ADD "loanId" uuid`);
        await queryRunner.query(`CREATE INDEX "IDX_d16020c22b950d376f8f7892cf" ON "TRANSACTIONS" ("loanId") `);
        await queryRunner.query(`ALTER TABLE "SYSTEM_CONFIG" ADD CONSTRAINT "FK_2553f73e02dd4e4bcbd6d0c744b" FOREIGN KEY ("updatedBy") REFERENCES "ADMIN_USERS"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "TRANSACTIONS" ADD CONSTRAINT "FK_d16020c22b950d376f8f7892cf1" FOREIGN KEY ("loanId") REFERENCES "LOANS"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "CREDIT_SCORE_HISTORY" ADD CONSTRAINT "FK_85381785073e48da8e8484e1484" FOREIGN KEY ("userId") REFERENCES "USERS"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "CREDIT_SCORE_HISTORY" ADD CONSTRAINT "FK_5f0a7d941365acc15193f1c4c7e" FOREIGN KEY ("loanId") REFERENCES "LOANS"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "CREDIT_SCORE_HISTORY" ADD CONSTRAINT "FK_9e5c5ecc511a183539e7bd4db85" FOREIGN KEY ("transactionId") REFERENCES "TRANSACTIONS"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "CREDIT_SCORE_HISTORY" DROP CONSTRAINT "FK_9e5c5ecc511a183539e7bd4db85"`);
        await queryRunner.query(`ALTER TABLE "CREDIT_SCORE_HISTORY" DROP CONSTRAINT "FK_5f0a7d941365acc15193f1c4c7e"`);
        await queryRunner.query(`ALTER TABLE "CREDIT_SCORE_HISTORY" DROP CONSTRAINT "FK_85381785073e48da8e8484e1484"`);
        await queryRunner.query(`ALTER TABLE "TRANSACTIONS" DROP CONSTRAINT "FK_d16020c22b950d376f8f7892cf1"`);
        await queryRunner.query(`ALTER TABLE "SYSTEM_CONFIG" DROP CONSTRAINT "FK_2553f73e02dd4e4bcbd6d0c744b"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d16020c22b950d376f8f7892cf"`);
        await queryRunner.query(`ALTER TABLE "TRANSACTIONS" DROP COLUMN "loanId"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_85381785073e48da8e8484e148"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5f0a7d941365acc15193f1c4c7"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9e5c5ecc511a183539e7bd4db8"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b8a941d54d001ed9c499a0db33"`);
        await queryRunner.query(`DROP TABLE "CREDIT_SCORE_HISTORY"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c5830db444891fafe32ecb91f9"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e583f660cd6a5c677292f6ab3a"`);
        await queryRunner.query(`DROP TABLE "SYSTEM_CONFIG"`);
    }

}
