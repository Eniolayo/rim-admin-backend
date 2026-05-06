import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Renames CSDP money columns from `*_kobo` (bigint) to `*_naira` (numeric(14,2)).
 * Existing values are preserved as-is — production rows in these columns were
 * inserted as naira despite the misleading column name.
 *
 * Exception: `csdp_eligibility_log.da_kobo` is intentionally kept as kobo
 * (raw audit of the inbound /profile request) and only made nullable.
 */
export class RenameCsdpKoboToNaira1777988862083 implements MigrationInterface {
  name = 'RenameCsdpKoboToNaira1777988862083';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // csdp_subscriber.outstanding_kobo -> outstanding_naira
    await queryRunner.query(
      `ALTER TABLE "csdp_subscriber" ALTER COLUMN "outstanding_kobo" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "csdp_subscriber" ALTER COLUMN "outstanding_kobo" TYPE numeric(14,2) USING "outstanding_kobo"::numeric`,
    );
    await queryRunner.query(
      `ALTER TABLE "csdp_subscriber" ALTER COLUMN "outstanding_kobo" SET DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "csdp_subscriber" RENAME COLUMN "outstanding_kobo" TO "outstanding_naira"`,
    );

    // csdp_recovery.amount_kobo -> amount_naira
    await queryRunner.query(
      `ALTER TABLE "csdp_recovery" ALTER COLUMN "amount_kobo" TYPE numeric(14,2) USING "amount_kobo"::numeric`,
    );
    await queryRunner.query(
      `ALTER TABLE "csdp_recovery" RENAME COLUMN "amount_kobo" TO "amount_naira"`,
    );

    // csdp_recovery_loan_item.amount_applied_kobo -> amount_applied_naira
    await queryRunner.query(
      `ALTER TABLE "csdp_recovery_loan_item" ALTER COLUMN "amount_applied_kobo" TYPE numeric(14,2) USING "amount_applied_kobo"::numeric`,
    );
    await queryRunner.query(
      `ALTER TABLE "csdp_recovery_loan_item" RENAME COLUMN "amount_applied_kobo" TO "amount_applied_naira"`,
    );

    // csdp_cdr_sdp.amount_kobo -> amount_naira
    await queryRunner.query(
      `ALTER TABLE "csdp_cdr_sdp" ALTER COLUMN "amount_kobo" TYPE numeric(14,2) USING "amount_kobo"::numeric`,
    );
    await queryRunner.query(
      `ALTER TABLE "csdp_cdr_sdp" RENAME COLUMN "amount_kobo" TO "amount_naira"`,
    );

    // csdp_cdr_refill.amount_kobo -> amount_naira
    await queryRunner.query(
      `ALTER TABLE "csdp_cdr_refill" ALTER COLUMN "amount_kobo" TYPE numeric(14,2) USING "amount_kobo"::numeric`,
    );
    await queryRunner.query(
      `ALTER TABLE "csdp_cdr_refill" RENAME COLUMN "amount_kobo" TO "amount_naira"`,
    );

    // csdp_eligibility_log: keep da_kobo as kobo but make it nullable;
    // rename teamwee_limit_kobo and rim_limit_kobo to *_naira (numeric).
    // (This entity is synchronize:false, so the generator skipped it.)
    await queryRunner.query(
      `ALTER TABLE "csdp_eligibility_log" ALTER COLUMN "da_kobo" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "csdp_eligibility_log" ALTER COLUMN "teamwee_limit_kobo" TYPE numeric(14,2) USING "teamwee_limit_kobo"::numeric`,
    );
    await queryRunner.query(
      `ALTER TABLE "csdp_eligibility_log" RENAME COLUMN "teamwee_limit_kobo" TO "teamwee_limit_naira"`,
    );
    await queryRunner.query(
      `ALTER TABLE "csdp_eligibility_log" ALTER COLUMN "rim_limit_kobo" TYPE numeric(14,2) USING "rim_limit_kobo"::numeric`,
    );
    await queryRunner.query(
      `ALTER TABLE "csdp_eligibility_log" RENAME COLUMN "rim_limit_kobo" TO "rim_limit_naira"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // csdp_eligibility_log
    await queryRunner.query(
      `ALTER TABLE "csdp_eligibility_log" RENAME COLUMN "rim_limit_naira" TO "rim_limit_kobo"`,
    );
    await queryRunner.query(
      `ALTER TABLE "csdp_eligibility_log" ALTER COLUMN "rim_limit_kobo" TYPE bigint USING round("rim_limit_kobo")::bigint`,
    );
    await queryRunner.query(
      `ALTER TABLE "csdp_eligibility_log" RENAME COLUMN "teamwee_limit_naira" TO "teamwee_limit_kobo"`,
    );
    await queryRunner.query(
      `ALTER TABLE "csdp_eligibility_log" ALTER COLUMN "teamwee_limit_kobo" TYPE bigint USING round("teamwee_limit_kobo")::bigint`,
    );
    // NOTE: re-applying NOT NULL on da_kobo will fail if any rows were written
    // with da_kobo IS NULL while the new schema was live. Backfill first if needed:
    //   UPDATE "csdp_eligibility_log" SET "da_kobo" = 0 WHERE "da_kobo" IS NULL;
    await queryRunner.query(
      `ALTER TABLE "csdp_eligibility_log" ALTER COLUMN "da_kobo" SET NOT NULL`,
    );

    // csdp_cdr_refill
    await queryRunner.query(
      `ALTER TABLE "csdp_cdr_refill" RENAME COLUMN "amount_naira" TO "amount_kobo"`,
    );
    await queryRunner.query(
      `ALTER TABLE "csdp_cdr_refill" ALTER COLUMN "amount_kobo" TYPE bigint USING round("amount_kobo")::bigint`,
    );

    // csdp_cdr_sdp
    await queryRunner.query(
      `ALTER TABLE "csdp_cdr_sdp" RENAME COLUMN "amount_naira" TO "amount_kobo"`,
    );
    await queryRunner.query(
      `ALTER TABLE "csdp_cdr_sdp" ALTER COLUMN "amount_kobo" TYPE bigint USING round("amount_kobo")::bigint`,
    );

    // csdp_recovery_loan_item
    await queryRunner.query(
      `ALTER TABLE "csdp_recovery_loan_item" RENAME COLUMN "amount_applied_naira" TO "amount_applied_kobo"`,
    );
    await queryRunner.query(
      `ALTER TABLE "csdp_recovery_loan_item" ALTER COLUMN "amount_applied_kobo" TYPE bigint USING round("amount_applied_kobo")::bigint`,
    );

    // csdp_recovery
    await queryRunner.query(
      `ALTER TABLE "csdp_recovery" RENAME COLUMN "amount_naira" TO "amount_kobo"`,
    );
    await queryRunner.query(
      `ALTER TABLE "csdp_recovery" ALTER COLUMN "amount_kobo" TYPE bigint USING round("amount_kobo")::bigint`,
    );

    // csdp_subscriber
    await queryRunner.query(
      `ALTER TABLE "csdp_subscriber" RENAME COLUMN "outstanding_naira" TO "outstanding_kobo"`,
    );
    await queryRunner.query(
      `ALTER TABLE "csdp_subscriber" ALTER COLUMN "outstanding_kobo" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "csdp_subscriber" ALTER COLUMN "outstanding_kobo" TYPE bigint USING round("outstanding_kobo")::bigint`,
    );
    await queryRunner.query(
      `ALTER TABLE "csdp_subscriber" ALTER COLUMN "outstanding_kobo" SET DEFAULT 0`,
    );
  }
}
