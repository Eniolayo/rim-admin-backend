import { MigrationInterface, QueryRunner } from "typeorm";

export class CsdpCoreBootstrap1777288545938 implements MigrationInterface {
    name = 'CsdpCoreBootstrap1777288545938'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "csdp_webhook_inbound_log" ("id" uuid NOT NULL, "kind" character varying(16) NOT NULL, "dedupe_key" character varying(128) NOT NULL, "body" jsonb NOT NULL, "headers" jsonb NOT NULL, "received_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_b1e2e99e4ed48d1b480e29781ef" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_793b374a1982e958961338ae79" ON "csdp_webhook_inbound_log" ("dedupe_key") `);
        await queryRunner.query(`CREATE TABLE "csdp_subscriber" ("msisdn" character varying(13) NOT NULL, "outstanding_kobo" bigint NOT NULL DEFAULT '0', "loans_taken" integer NOT NULL DEFAULT '0', "loans_recovered" integer NOT NULL DEFAULT '0', "blacklisted" boolean NOT NULL DEFAULT false, "last_eligibility_at" TIMESTAMP, "last_loan_at" TIMESTAMP, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_dcc0edbe2e3f47ca932653afc64" PRIMARY KEY ("msisdn"))`);
        await queryRunner.query(`CREATE INDEX "IDX_257b7157210c9e4c09ca23e4b5" ON "csdp_subscriber" ("last_eligibility_at") `);
        await queryRunner.query(`CREATE INDEX "IDX_bdb614638e1a81e93062c3018e" ON "csdp_subscriber" ("last_loan_at") `);
        await queryRunner.query(`CREATE TABLE "csdp_recovery" ("recovery_id" character varying(64) NOT NULL, "msisdn" character varying(13) NOT NULL, "amount_kobo" bigint NOT NULL, "recovered_at" TIMESTAMP WITH TIME ZONE NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_94acacb7c20da9751f121f8bdf6" PRIMARY KEY ("recovery_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_0215913bf457a10165c8d5f465" ON "csdp_recovery" ("msisdn") `);
        await queryRunner.query(`CREATE TABLE "csdp_loan" ("loan_id" character varying(64) NOT NULL, "msisdn" character varying(13) NOT NULL, "vendor" character varying(32) NOT NULL, "loan_type" character varying(16) NOT NULL, "principal_naira" numeric(12,2) NOT NULL, "repayable_naira" numeric(12,2) NOT NULL, "status" character varying(16) NOT NULL, "trans_ref" character varying(64), "issued_at" TIMESTAMP NOT NULL, "recovered_at" TIMESTAMP, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_9c72a94cd90e72498c90ae1798f" PRIMARY KEY ("loan_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_e78fbf69d6530880431e2679af" ON "csdp_loan" ("msisdn") `);
        await queryRunner.query(`CREATE INDEX "IDX_9b7f96bf31e31fef7d947314e7" ON "csdp_loan" ("trans_ref") `);
        await queryRunner.query(`CREATE TABLE "csdp_recovery_loan_item" ("recovery_id" character varying(64) NOT NULL, "loan_id" character varying(64) NOT NULL, "amount_applied_kobo" bigint NOT NULL, "recoveryRecoveryId" character varying(64), "loanLoanId" character varying(64), CONSTRAINT "PK_51991deea96bad4ed99cd89c9ea" PRIMARY KEY ("recovery_id", "loan_id"))`);
        await queryRunner.query(`CREATE TABLE "csdp_ingest_row" ("id" BIGSERIAL NOT NULL, "batch_id" uuid NOT NULL, "source" character varying(32) NOT NULL, "file_date" date NOT NULL, "external_id" character varying(128) NOT NULL, "line_no" integer NOT NULL, "raw_line" text NOT NULL, "parsed" jsonb, "status" character varying(16) NOT NULL, "error_reason" character varying(255), CONSTRAINT "uq_ingest_row_source_date_ext" UNIQUE ("source", "file_date", "external_id"), CONSTRAINT "PK_cc1659b22087672e2cbf788c606" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_1142bcb21811c34ea54071d5c9" ON "csdp_ingest_row" ("batch_id") `);
        await queryRunner.query(`CREATE TABLE "csdp_ingest_batch" ("id" uuid NOT NULL, "source" character varying(32) NOT NULL, "file_date" date NOT NULL, "file_hash" character varying(64) NOT NULL, "status" character varying(16) NOT NULL, "storage_uri" character varying(512) NOT NULL, "rows_total" integer NOT NULL DEFAULT '0', "rows_ok" integer NOT NULL DEFAULT '0', "rows_rejected" integer NOT NULL DEFAULT '0', "error_message" text, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "parsed_at" TIMESTAMP, CONSTRAINT "PK_d4d5763c7879444ea57343ddc28" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_30fce54cc0436ec0c687321bf1" ON "csdp_ingest_batch" ("file_hash") `);
        await queryRunner.query(`CREATE TABLE "csdp_feature_flag" ("key" character varying(64) NOT NULL, "value" jsonb NOT NULL, "updated_by" character varying(64), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_75eea72721cb0e2853885340433" PRIMARY KEY ("key"))`);
        await queryRunner.query(`CREATE TABLE "csdp_eligibility_outcome" ("eligibility_log_id" uuid NOT NULL, "loan_id" character varying(64), "loan_issued" boolean NOT NULL DEFAULT false, "fully_recovered" boolean NOT NULL DEFAULT false, "days_to_recover" integer, "linked_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_67ac95ba50f74428ab7530de0f4" PRIMARY KEY ("eligibility_log_id"))`);
        await queryRunner.query(`CREATE TABLE "csdp_cdr_sdp" ("id" BIGSERIAL NOT NULL, "batch_id" uuid NOT NULL, "msisdn" character varying(13) NOT NULL, "event_at" TIMESTAMP WITH TIME ZONE NOT NULL, "amount_kobo" bigint NOT NULL, "raw" jsonb NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_6c372d31ea9959d86ca509a0b6a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_e0f843518af2f20a1cbbf2a7f1" ON "csdp_cdr_sdp" ("batch_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_3de2447a317dd4751ac4a166b6" ON "csdp_cdr_sdp" ("msisdn") `);
        await queryRunner.query(`CREATE INDEX "IDX_8f7c8cfc47d20b21c74543c8b9" ON "csdp_cdr_sdp" ("event_at") `);
        await queryRunner.query(`CREATE TABLE "csdp_cdr_refill" ("id" BIGSERIAL NOT NULL, "batch_id" uuid NOT NULL, "msisdn" character varying(13) NOT NULL, "event_at" TIMESTAMP WITH TIME ZONE NOT NULL, "amount_kobo" bigint NOT NULL, "raw" jsonb NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_7a0df679d7ce372cc154727740c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_2c7f75aef1272cb59fa240dd96" ON "csdp_cdr_refill" ("batch_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_648fd0d9c66862e98b7c3de8a2" ON "csdp_cdr_refill" ("msisdn") `);
        await queryRunner.query(`CREATE INDEX "IDX_b57f7f0de4ad2de7114d0be5c5" ON "csdp_cdr_refill" ("event_at") `);
        await queryRunner.query(`ALTER TABLE "csdp_recovery_loan_item" ADD CONSTRAINT "FK_7c05e97ff5321bfc2a0d4531816" FOREIGN KEY ("recoveryRecoveryId") REFERENCES "csdp_recovery"("recovery_id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "csdp_recovery_loan_item" ADD CONSTRAINT "FK_a2605f183e59fbb37942a80c493" FOREIGN KEY ("loanLoanId") REFERENCES "csdp_loan"("loan_id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "csdp_recovery_loan_item" DROP CONSTRAINT "FK_a2605f183e59fbb37942a80c493"`);
        await queryRunner.query(`ALTER TABLE "csdp_recovery_loan_item" DROP CONSTRAINT "FK_7c05e97ff5321bfc2a0d4531816"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b57f7f0de4ad2de7114d0be5c5"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_648fd0d9c66862e98b7c3de8a2"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2c7f75aef1272cb59fa240dd96"`);
        await queryRunner.query(`DROP TABLE "csdp_cdr_refill"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8f7c8cfc47d20b21c74543c8b9"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_3de2447a317dd4751ac4a166b6"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e0f843518af2f20a1cbbf2a7f1"`);
        await queryRunner.query(`DROP TABLE "csdp_cdr_sdp"`);
        await queryRunner.query(`DROP TABLE "csdp_eligibility_outcome"`);
        await queryRunner.query(`DROP TABLE "csdp_feature_flag"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_30fce54cc0436ec0c687321bf1"`);
        await queryRunner.query(`DROP TABLE "csdp_ingest_batch"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1142bcb21811c34ea54071d5c9"`);
        await queryRunner.query(`DROP TABLE "csdp_ingest_row"`);
        await queryRunner.query(`DROP TABLE "csdp_recovery_loan_item"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9b7f96bf31e31fef7d947314e7"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e78fbf69d6530880431e2679af"`);
        await queryRunner.query(`DROP TABLE "csdp_loan"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0215913bf457a10165c8d5f465"`);
        await queryRunner.query(`DROP TABLE "csdp_recovery"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_bdb614638e1a81e93062c3018e"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_257b7157210c9e4c09ca23e4b5"`);
        await queryRunner.query(`DROP TABLE "csdp_subscriber"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_793b374a1982e958961338ae79"`);
        await queryRunner.query(`DROP TABLE "csdp_webhook_inbound_log"`);
    }

}
