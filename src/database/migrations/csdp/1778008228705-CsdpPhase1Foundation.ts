import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * CSDP Phase 1 — Foundation
 *
 * Creates the schema required by `heuristic_v3` and the surrounding
 * snapshot/history audit trail. Adds CHECK constraints on every new
 * MSISDN column so callers can never persist a non-canonical value
 * (must match `^234\d{10}$`).
 *
 * Also extends:
 *   - csdp_loan.status: drops CANCELLED, adds PARTIAL. Pre-migrates any
 *     existing CANCELLED rows to DEFAULTED.
 *   - csdp_eligibility_log: adds heuristic_v3 §8 columns. The entity
 *     has `synchronize: false`, so this DDL is hand-added.
 */
export class CsdpPhase1Foundation1778008228705 implements MigrationInterface {
    name = 'CsdpPhase1Foundation1778008228705'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // ──────────────────────────────────────────────────────────────────
        // New tables (auto-generated DDL)
        // ──────────────────────────────────────────────────────────────────
        await queryRunner.query(`CREATE TABLE "csdp_subscriber_feature_row" ("msisdn" character varying(13) NOT NULL, "days_on_network" integer NOT NULL DEFAULT '0', "recharge_count_30d" integer NOT NULL DEFAULT '0', "loans_taken_180d" integer NOT NULL DEFAULT '0', "loans_recovered_180d" integer NOT NULL DEFAULT '0', "historical_cured_defaults_180d" integer NOT NULL DEFAULT '0', "historical_cured_defaults_lifetime" integer NOT NULL DEFAULT '0', "uncured_default_exists" boolean NOT NULL DEFAULT false, "our_outstanding_kobo" bigint NOT NULL DEFAULT '0', "our_disbursed_24h_naira" integer NOT NULL DEFAULT '0', "eligibility_checks_1h" integer NOT NULL DEFAULT '0', "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_d0a23b128270617c9dce9a0be9c" PRIMARY KEY ("msisdn"))`);
        await queryRunner.query(`CREATE INDEX "IDX_4409e08cad52b96934a05942dc" ON "csdp_subscriber_feature_row" ("updated_at") `);
        await queryRunner.query(`CREATE TABLE "csdp_loan_features_snapshot" ("loan_id" character varying(64) NOT NULL, "msisdn" character varying(13) NOT NULL, "trans_ref" character varying(64), "feature_row_snapshot" jsonb NOT NULL, "snapshot_mismatch" boolean NOT NULL DEFAULT false, "captured_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_f4d71fceaf40275533930ffefb1" PRIMARY KEY ("loan_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_25bab653c60ba04fbd592ae14e" ON "csdp_loan_features_snapshot" ("msisdn") `);
        await queryRunner.query(`CREATE INDEX "IDX_26b0ce9219d82a115f71777609" ON "csdp_loan_features_snapshot" ("snapshot_mismatch") `);
        await queryRunner.query(`CREATE TABLE "csdp_eligibility_features_snapshot" ("trans_ref" character varying(64) NOT NULL, "msisdn" character varying(13) NOT NULL, "feature_row_snapshot" jsonb NOT NULL, "captured_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_5c3098f8e031946724b64765224" PRIMARY KEY ("trans_ref"))`);
        await queryRunner.query(`CREATE INDEX "IDX_001f807ee291496528a5dab08c" ON "csdp_eligibility_features_snapshot" ("msisdn", "captured_at") `);
        await queryRunner.query(`CREATE TABLE "csdp_credit_score_history" ("id" BIGSERIAL NOT NULL, "msisdn" character varying(13) NOT NULL, "score" integer NOT NULL, "score_components" jsonb NOT NULL, "change_reason" character varying(64) NOT NULL, "model_version" character varying(32) NOT NULL, "recorded_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_b1781e6724e1f91408b44711a75" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_12a9eb5f70cf433b684a17812e" ON "csdp_credit_score_history" ("msisdn", "recorded_at") `);
        await queryRunner.query(`CREATE TABLE "csdp_credit_profile" ("msisdn" character varying(13) NOT NULL, "blacklisted" boolean NOT NULL DEFAULT false, "blacklist_reason" character varying(128), "admin_override_limit_naira" integer, "admin_override_set_by" character varying(64), "admin_override_set_at" TIMESTAMP, "persisted_limit_naira" integer, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_75d29e08c94fa5d765f4da0b150" PRIMARY KEY ("msisdn"))`);

        // ──────────────────────────────────────────────────────────────────
        // CHECK constraint enforcing canonical MSISDN form on every new
        // table that stores one. Mirrors `MSISDN_REGEX` in phone.utils.ts.
        // ──────────────────────────────────────────────────────────────────
        await queryRunner.query(`ALTER TABLE "csdp_subscriber_feature_row" ADD CONSTRAINT "CHK_csdp_subscriber_feature_row_msisdn" CHECK ("msisdn" ~ '^234[0-9]{10}$')`);
        await queryRunner.query(`ALTER TABLE "csdp_loan_features_snapshot" ADD CONSTRAINT "CHK_csdp_loan_features_snapshot_msisdn" CHECK ("msisdn" ~ '^234[0-9]{10}$')`);
        await queryRunner.query(`ALTER TABLE "csdp_eligibility_features_snapshot" ADD CONSTRAINT "CHK_csdp_eligibility_features_snapshot_msisdn" CHECK ("msisdn" ~ '^234[0-9]{10}$')`);
        await queryRunner.query(`ALTER TABLE "csdp_credit_score_history" ADD CONSTRAINT "CHK_csdp_credit_score_history_msisdn" CHECK ("msisdn" ~ '^234[0-9]{10}$')`);
        await queryRunner.query(`ALTER TABLE "csdp_credit_profile" ADD CONSTRAINT "CHK_csdp_credit_profile_msisdn" CHECK ("msisdn" ~ '^234[0-9]{10}$')`);

        // ──────────────────────────────────────────────────────────────────
        // csdp_loan.status: add PARTIAL, drop CANCELLED.
        // Migrate any pre-existing CANCELLED rows to DEFAULTED before the
        // CHECK constraint locks the values down.
        // ──────────────────────────────────────────────────────────────────
        await queryRunner.query(`UPDATE "csdp_loan" SET "status" = 'DEFAULTED' WHERE "status" = 'CANCELLED'`);
        await queryRunner.query(`ALTER TABLE "csdp_loan" DROP CONSTRAINT IF EXISTS "CHK_csdp_loan_status"`);
        await queryRunner.query(`ALTER TABLE "csdp_loan" ADD CONSTRAINT "CHK_csdp_loan_status" CHECK ("status" IN ('ISSUED','PARTIAL','RECOVERED','DEFAULTED'))`);

        // ──────────────────────────────────────────────────────────────────
        // csdp_eligibility_log: add heuristic_v3 scoring columns (§8).
        // Entity has `synchronize: false`, so this DDL is hand-added.
        // All columns nullable so existing shadow writers keep working.
        // ──────────────────────────────────────────────────────────────────
        await queryRunner.query(`ALTER TABLE "csdp_eligibility_log" ADD COLUMN IF NOT EXISTS "score" integer`);
        await queryRunner.query(`ALTER TABLE "csdp_eligibility_log" ADD COLUMN IF NOT EXISTS "score_components" jsonb`);
        await queryRunner.query(`ALTER TABLE "csdp_eligibility_log" ADD COLUMN IF NOT EXISTS "base_limit_naira" integer`);
        await queryRunner.query(`ALTER TABLE "csdp_eligibility_log" ADD COLUMN IF NOT EXISTS "partner_residual_naira" integer`);
        await queryRunner.query(`ALTER TABLE "csdp_eligibility_log" ADD COLUMN IF NOT EXISTS "daily_user_remaining_naira" integer`);
        await queryRunner.query(`ALTER TABLE "csdp_eligibility_log" ADD COLUMN IF NOT EXISTS "system_exposure_pct" real`);
        await queryRunner.query(`ALTER TABLE "csdp_eligibility_log" ADD COLUMN IF NOT EXISTS "final_limit_naira" integer`);
        await queryRunner.query(`ALTER TABLE "csdp_eligibility_log" ADD COLUMN IF NOT EXISTS "model_version" character varying(32)`);
        await queryRunner.query(`ALTER TABLE "csdp_eligibility_log" ADD COLUMN IF NOT EXISTS "gate_failed" character varying(32)`);
        await queryRunner.query(`ALTER TABLE "csdp_eligibility_log" ADD COLUMN IF NOT EXISTS "snapshot_mismatch" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "csdp_eligibility_log" ADD CONSTRAINT "CHK_csdp_eligibility_log_gate_failed" CHECK ("gate_failed" IS NULL OR "gate_failed" IN ('BLACKLIST','OUTSTANDING','DA_CAP','UNCURED_DEFAULT','VELOCITY','TYPE_DISABLED'))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Revert csdp_eligibility_log additions
        await queryRunner.query(`ALTER TABLE "csdp_eligibility_log" DROP CONSTRAINT IF EXISTS "CHK_csdp_eligibility_log_gate_failed"`);
        await queryRunner.query(`ALTER TABLE "csdp_eligibility_log" DROP COLUMN IF EXISTS "snapshot_mismatch"`);
        await queryRunner.query(`ALTER TABLE "csdp_eligibility_log" DROP COLUMN IF EXISTS "gate_failed"`);
        await queryRunner.query(`ALTER TABLE "csdp_eligibility_log" DROP COLUMN IF EXISTS "model_version"`);
        await queryRunner.query(`ALTER TABLE "csdp_eligibility_log" DROP COLUMN IF EXISTS "final_limit_naira"`);
        await queryRunner.query(`ALTER TABLE "csdp_eligibility_log" DROP COLUMN IF EXISTS "system_exposure_pct"`);
        await queryRunner.query(`ALTER TABLE "csdp_eligibility_log" DROP COLUMN IF EXISTS "daily_user_remaining_naira"`);
        await queryRunner.query(`ALTER TABLE "csdp_eligibility_log" DROP COLUMN IF EXISTS "partner_residual_naira"`);
        await queryRunner.query(`ALTER TABLE "csdp_eligibility_log" DROP COLUMN IF EXISTS "base_limit_naira"`);
        await queryRunner.query(`ALTER TABLE "csdp_eligibility_log" DROP COLUMN IF EXISTS "score_components"`);
        await queryRunner.query(`ALTER TABLE "csdp_eligibility_log" DROP COLUMN IF EXISTS "score"`);

        // Revert csdp_loan.status CHECK (no row backfill — CANCELLED rows already converted)
        await queryRunner.query(`ALTER TABLE "csdp_loan" DROP CONSTRAINT IF EXISTS "CHK_csdp_loan_status"`);

        // Drop new tables (CHECK constraints fall with their tables)
        await queryRunner.query(`DROP TABLE "csdp_credit_profile"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_12a9eb5f70cf433b684a17812e"`);
        await queryRunner.query(`DROP TABLE "csdp_credit_score_history"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_001f807ee291496528a5dab08c"`);
        await queryRunner.query(`DROP TABLE "csdp_eligibility_features_snapshot"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_26b0ce9219d82a115f71777609"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_25bab653c60ba04fbd592ae14e"`);
        await queryRunner.query(`DROP TABLE "csdp_loan_features_snapshot"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_4409e08cad52b96934a05942dc"`);
        await queryRunner.query(`DROP TABLE "csdp_subscriber_feature_row"`);
    }

}
