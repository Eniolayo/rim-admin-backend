import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLogProtection1767274278343 implements MigrationInterface {
  name = 'AddLogProtection1767274278343';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create the reject_modification function
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION reject_modification()
      RETURNS TRIGGER AS $$
      BEGIN
        RAISE EXCEPTION 'Modification of audit logs is not allowed. Table: %', TG_TABLE_NAME;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Enable RLS and create policies for ADMIN_ACTIVITY_LOGS
    await queryRunner.query(
      `ALTER TABLE "ADMIN_ACTIVITY_LOGS" ENABLE ROW LEVEL SECURITY;`,
    );
    await queryRunner.query(`
      CREATE POLICY admin_activity_logs_insert_only 
      ON "ADMIN_ACTIVITY_LOGS"
      FOR ALL 
      USING (true)
      WITH CHECK (true);
    `);
    await queryRunner.query(`
      CREATE TRIGGER prevent_admin_activity_log_modification
      BEFORE UPDATE OR DELETE ON "ADMIN_ACTIVITY_LOGS"
      FOR EACH ROW
      EXECUTE FUNCTION reject_modification();
    `);

    // Enable RLS and create policies for TICKET_HISTORY
    await queryRunner.query(
      `ALTER TABLE "TICKET_HISTORY" ENABLE ROW LEVEL SECURITY;`,
    );
    await queryRunner.query(`
      CREATE POLICY ticket_history_insert_only 
      ON "TICKET_HISTORY"
      FOR ALL 
      USING (true)
      WITH CHECK (true);
    `);
    await queryRunner.query(`
      CREATE TRIGGER prevent_ticket_history_modification
      BEFORE UPDATE OR DELETE ON "TICKET_HISTORY"
      FOR EACH ROW
      EXECUTE FUNCTION reject_modification();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop triggers
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS prevent_admin_activity_log_modification ON "ADMIN_ACTIVITY_LOGS";`,
    );
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS prevent_ticket_history_modification ON "TICKET_HISTORY";`,
    );

    // Drop policies
    await queryRunner.query(
      `DROP POLICY IF EXISTS admin_activity_logs_insert_only ON "ADMIN_ACTIVITY_LOGS";`,
    );
    await queryRunner.query(
      `DROP POLICY IF EXISTS ticket_history_insert_only ON "TICKET_HISTORY";`,
    );

    // Disable RLS
    await queryRunner.query(
      `ALTER TABLE "ADMIN_ACTIVITY_LOGS" DISABLE ROW LEVEL SECURITY;`,
    );
    await queryRunner.query(
      `ALTER TABLE "TICKET_HISTORY" DISABLE ROW LEVEL SECURITY;`,
    );

    // Drop function
    await queryRunner.query(`DROP FUNCTION IF EXISTS reject_modification();`);
  }
}

