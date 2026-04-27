import { MigrationInterface, QueryRunner } from "typeorm";

export class FixMissingEligibilityLog1777294981742 implements MigrationInterface {
    name = 'FixMissingEligibilityLog1777294981742'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "csdp_eligibility_log" (
                "id" uuid NOT NULL,
                "requested_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
                "msisdn" character varying(13) NOT NULL,
                "trans_ref" character varying(64) NOT NULL,
                "da_kobo" bigint NOT NULL,
                "loan_type" character varying(16) NOT NULL,
                "teamwee_limit_kobo" bigint,
                "rim_limit_kobo" bigint,
                "winner" character varying(16) NOT NULL,
                "decision_mode" character varying(16) NOT NULL,
                "total_latency_ms" integer,
                "teamwee_latency_ms" integer,
                "rim_latency_ms" integer,
                "error_reason" character varying(255),
                CONSTRAINT "PK_csdp_eligibility_log_id_requested_at"
                    PRIMARY KEY ("id", "requested_at")
            )
        `);

        await queryRunner.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS "uq_csdp_eligibility_log_trans_ref"
            ON "csdp_eligibility_log" ("trans_ref")
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_csdp_eligibility_log_msisdn"
            ON "csdp_eligibility_log" ("msisdn")
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_csdp_eligibility_log_requested_at"
            ON "csdp_eligibility_log" ("requested_at")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_csdp_eligibility_log_requested_at"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_csdp_eligibility_log_msisdn"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "uq_csdp_eligibility_log_trans_ref"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "csdp_eligibility_log"`);
    }
}

