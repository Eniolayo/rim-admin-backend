import { MigrationInterface, QueryRunner } from "typeorm";

export class Notification1763861591447 implements MigrationInterface {
    name = 'Notification1763861591447'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."NOTIFICATIONS_type_enum" AS ENUM('ticket_created', 'ticket_assigned', 'ticket_escalated', 'loan_approved', 'loan_disbursed', 'high_risk_transaction', 'transaction_completed', 'credit_limit_updated')`);
        await queryRunner.query(`CREATE TYPE "public"."NOTIFICATIONS_status_enum" AS ENUM('unread', 'read')`);
        await queryRunner.query(`CREATE TYPE "public"."NOTIFICATIONS_relatedentitytype_enum" AS ENUM('ticket', 'loan', 'transaction', 'user')`);
        await queryRunner.query(`CREATE TABLE "NOTIFICATIONS" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "type" "public"."NOTIFICATIONS_type_enum" NOT NULL, "title" character varying(255) NOT NULL, "message" text NOT NULL, "recipientId" uuid NOT NULL, "status" "public"."NOTIFICATIONS_status_enum" NOT NULL DEFAULT 'unread', "readAt" TIMESTAMP, "relatedEntityType" "public"."NOTIFICATIONS_relatedentitytype_enum", "relatedEntityId" uuid, "metadata" jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_7618abcba1847d13efd482fbc26" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_5acd8d2d2be7dde3d1ed560586" ON "NOTIFICATIONS" ("relatedEntityType", "relatedEntityId") `);
        await queryRunner.query(`CREATE INDEX "IDX_e7dbb47743e62809e857110ee7" ON "NOTIFICATIONS" ("createdAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_265ad42d68c487c6817e591ab1" ON "NOTIFICATIONS" ("status") `);
        await queryRunner.query(`CREATE INDEX "IDX_9366be13fef975542aa1512b35" ON "NOTIFICATIONS" ("type") `);
        await queryRunner.query(`CREATE INDEX "IDX_4e2c0b85c262c551626c81f8f8" ON "NOTIFICATIONS" ("recipientId") `);
        await queryRunner.query(`ALTER TABLE "NOTIFICATIONS" ADD CONSTRAINT "FK_4e2c0b85c262c551626c81f8f8e" FOREIGN KEY ("recipientId") REFERENCES "ADMIN_USERS"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "NOTIFICATIONS" DROP CONSTRAINT "FK_4e2c0b85c262c551626c81f8f8e"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_4e2c0b85c262c551626c81f8f8"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9366be13fef975542aa1512b35"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_265ad42d68c487c6817e591ab1"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e7dbb47743e62809e857110ee7"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5acd8d2d2be7dde3d1ed560586"`);
        await queryRunner.query(`DROP TABLE "NOTIFICATIONS"`);
        await queryRunner.query(`DROP TYPE "public"."NOTIFICATIONS_relatedentitytype_enum"`);
        await queryRunner.query(`DROP TYPE "public"."NOTIFICATIONS_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."NOTIFICATIONS_type_enum"`);
    }

}
