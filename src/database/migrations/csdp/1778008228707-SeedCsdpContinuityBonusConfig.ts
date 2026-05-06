import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 3 — seeds the §5.5 cold-start cliff continuity bonus config
 * keys. See docs/CSDP_MIGRATION_PHASES.md §"Phase 3 — Step 4" and
 * heuristic-v3.ts CsdpConfig fields `continuityBonusMaxNaira` /
 * `continuityBonusLoanWindow`.
 *
 * Idempotent — ON CONFLICT DO NOTHING. Safe to re-run.
 */
export class SeedCsdpContinuityBonusConfig1778008228707
  implements MigrationInterface
{
  name = 'SeedCsdpContinuityBonusConfig1778008228707';

  private static readonly CATEGORY = 'csdp_scoring';

  private static readonly ENTRIES: Array<[string, string, string]> = [
    [
      'csdp.coldstart.continuity_bonus_max_naira',
      '100',
      '§5.5 continuity bonus (₦) for first post-cold-start loan; decays linearly across the loan window',
    ],
    [
      'csdp.coldstart.continuity_bonus_loan_window',
      '3',
      '§5.5 number of post-cold-start loans the continuity bonus applies to',
    ],
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [key, jsonValue, description] of SeedCsdpContinuityBonusConfig1778008228707.ENTRIES) {
      await queryRunner.query(
        `INSERT INTO "SYSTEM_CONFIG" ("category", "key", "value", "description")
         VALUES ($1, $2, $3::jsonb, $4)
         ON CONFLICT ("category", "key") DO NOTHING`,
        [SeedCsdpContinuityBonusConfig1778008228707.CATEGORY, key, jsonValue, description],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const [key] of SeedCsdpContinuityBonusConfig1778008228707.ENTRIES) {
      await queryRunner.query(
        `DELETE FROM "SYSTEM_CONFIG" WHERE "category" = $1 AND "key" = $2`,
        [SeedCsdpContinuityBonusConfig1778008228707.CATEGORY, key],
      );
    }
  }
}
