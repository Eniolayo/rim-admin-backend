import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Seeds SYSTEM_CONFIG with the `csdp.*` keys defined in
 * docs/CSDP_SCORING_ALGORITHM.md §11. All values are spec defaults; ops can
 * tune any of them post-seed via the (Phase 4) admin UI.
 *
 * Idempotent: ON CONFLICT DO NOTHING on (category, key). Safe to re-run.
 */
export class SeedCsdpScoringConfig1778008228706 implements MigrationInterface {
  name = 'SeedCsdpScoringConfig1778008228706';

  private static readonly CATEGORY = 'csdp_scoring';

  /** [key, jsonb-encoded value, description] */
  private static readonly ENTRIES: Array<[string, string, string]> = [
    // --- Bayesian prior + evidence (scoring §5) ---
    ['csdp.score.prior_alpha', '2', '§5 Bayesian Beta prior alpha (success pseudo-count)'],
    ['csdp.score.prior_beta', '2', '§5 Bayesian Beta prior beta (failure pseudo-count)'],
    ['csdp.score.confidence_pseudo_n', '4', '§5 confidence smoothing: pseudo-observations'],
    ['csdp.score.evidence_max', '800', '§5 evidence-score saturation cap'],

    // --- Tenure / engagement multipliers ---
    ['csdp.score.tenure_mult_min', '0.85', '§5.2 minimum tenure multiplier (cold-start floor)'],
    ['csdp.score.tenure_sat_days', '365', '§5.2 days-on-network at which tenure mult = 1.0'],
    ['csdp.score.engagement_mult_min', '0.70', '§5.2 minimum engagement multiplier'],
    ['csdp.score.engagement_sat', '20', '§5.2 recharges/30d at which engagement mult = 1.0'],

    // --- Cold start ---
    ['csdp.score.cold_start_base', '200', '§5.3 cold-start base score for thin-file approve'],
    ['csdp.score.cold_start_min_tenure_days', '60', '§5.3 minimum tenure for cold-start eligibility'],
    ['csdp.score.cold_start_min_engagement', '0.75', '§5.3 minimum engagement mult for cold-start'],

    // --- Penalties ---
    ['csdp.score.penalty_cured_recent', '100', '§5.5 penalty per cured default in last 180d'],
    ['csdp.score.penalty_cured_lifetime', '30', '§5.5 penalty per lifetime cured default'],
    ['csdp.score.penalty_cured_lifetime_cap', '150', '§5.5 cap on lifetime cured-default penalty'],
    ['csdp.score.penalty_velocity', '5', '§5.5 per-check soft penalty when velocity_threshold exceeded'],
    ['csdp.score.velocity_threshold', '3', '§5.5 eligibility checks/1h triggering velocity penalty'],

    // --- Stage 3: limit-curve anchors ---
    ['csdp.tier.base_threshold', '300', '§6 baseline approval threshold (post thin-file bonus)'],
    ['csdp.tier.thin_file_max_bonus', '220', '§6.1 max thin-file bonus when taken_180d = 0'],
    ['csdp.tier.thin_file_saturation', '6', '§6.1 taken_180d at which thin-file bonus → 0'],
    ['csdp.tier.curve_exponent', '0.85', '§6 limit curve exponent'],
    ['csdp.tier.anchors.AIRTIME.small_min', '50', '§6 AIRTIME minimum issuable limit (₦)'],
    ['csdp.tier.anchors.AIRTIME.max_limit', '1500', '§6 AIRTIME maximum limit anchor (₦)'],
    ['csdp.tier.anchors.DATA.small_min', '100', '§6 DATA minimum issuable limit (₦)'],
    ['csdp.tier.anchors.DATA.max_limit', '3000', '§6 DATA maximum limit anchor (₦)'],
    ['csdp.tier.anchors.TALKTIME.small_min', '50', '§6 TALKTIME minimum issuable limit (₦)'],
    ['csdp.tier.anchors.TALKTIME.max_limit', '1000', '§6 TALKTIME maximum limit anchor (₦)'],

    // --- Stage 4: clamps + gates ---
    ['csdp.partner_cap_naira', '5000', '§7 partner-residual cap (₦)'],
    ['csdp.daily_user_cap_naira.AIRTIME', '1500', '§7 AIRTIME daily-per-user cap (₦)'],
    ['csdp.daily_user_cap_naira.DATA', '3000', '§7 DATA daily-per-user cap (₦)'],
    ['csdp.daily_user_cap_naira.TALKTIME', '1000', '§7 TALKTIME daily-per-user cap (₦)'],
    ['csdp.exposure.taper_start_pct', '0.85', '§7 system-exposure pct at which taper begins'],
    ['csdp.exposure.halt_pct', '0.95', '§7 system-exposure pct at which all approvals halt'],
    ['csdp.exposure.budget_kobo', '0', '§7 daily disbursement budget (kobo); ops sets pre-LIVE'],
    ['csdp.gate.velocity_extreme', '10', '§7 hard-gate velocity (eligibility checks / 1h)'],
    ['csdp.loan_type_enabled.AIRTIME', 'true', '§7 kill switch: AIRTIME loan type enabled'],
    ['csdp.loan_type_enabled.DATA', 'true', '§7 kill switch: DATA loan type enabled'],
    ['csdp.loan_type_enabled.TALKTIME', 'true', '§7 kill switch: TALKTIME loan type enabled'],
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [key, jsonValue, description] of SeedCsdpScoringConfig1778008228706.ENTRIES) {
      await queryRunner.query(
        `INSERT INTO "SYSTEM_CONFIG" ("category", "key", "value", "description")
         VALUES ($1, $2, $3::jsonb, $4)
         ON CONFLICT ("category", "key") DO NOTHING`,
        [SeedCsdpScoringConfig1778008228706.CATEGORY, key, jsonValue, description],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "SYSTEM_CONFIG" WHERE "category" = $1`,
      [SeedCsdpScoringConfig1778008228706.CATEGORY],
    );
  }
}
