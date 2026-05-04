import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSubscriberDiscrepancyLog1777925594281 implements MigrationInterface {
    name = 'AddSubscriberDiscrepancyLog1777925594281'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "csdp_subscriber_discrepancy_log" ("id" BIGSERIAL NOT NULL, "msisdn" character varying(13) NOT NULL, "field" character varying(64) NOT NULL, "existing_value" text, "incoming_value" text, "batch_id" uuid NOT NULL, "row_line_no" integer, "detected_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_747b7ee05c4a2f93d3a03c15b54" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_01cddcb939e5d01a214e82140a" ON "csdp_subscriber_discrepancy_log" ("msisdn") `);
        await queryRunner.query(`CREATE INDEX "IDX_874081ad69b9722547d8befe8a" ON "csdp_subscriber_discrepancy_log" ("batch_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_34996e96ecee3ed13aed07297a" ON "csdp_subscriber_discrepancy_log" ("detected_at") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_34996e96ecee3ed13aed07297a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_874081ad69b9722547d8befe8a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_01cddcb939e5d01a214e82140a"`);
        await queryRunner.query(`DROP TABLE "csdp_subscriber_discrepancy_log"`);
    }

}
