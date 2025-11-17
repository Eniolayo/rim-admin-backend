import { MigrationInterface, QueryRunner } from "typeorm";

export class AdminInvitation1763177874180 implements MigrationInterface {
    name = 'AdminInvitation1763177874180'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."ADMIN_INVITATIONS_role_enum" AS ENUM('super_admin', 'admin', 'moderator')`);
        await queryRunner.query(`CREATE TYPE "public"."ADMIN_INVITATIONS_status_enum" AS ENUM('pending', 'accepted', 'expired')`);
        await queryRunner.query(`CREATE TABLE "ADMIN_INVITATIONS" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying(255) NOT NULL, "role" "public"."ADMIN_INVITATIONS_role_enum" NOT NULL, "inviteToken" character varying(255) NOT NULL, "invitedBy" uuid NOT NULL, "invitedByName" character varying(255) NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "expiresAt" TIMESTAMP NOT NULL, "acceptedAt" TIMESTAMP, "status" "public"."ADMIN_INVITATIONS_status_enum" NOT NULL DEFAULT 'pending', CONSTRAINT "UQ_5f47b61c5ca2e938352ed82c350" UNIQUE ("inviteToken"), CONSTRAINT "PK_0209863d186e38e812172f99b89" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_3afad0f7351fd52803b4d9c391" ON "ADMIN_INVITATIONS" ("expiresAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_5b897574caa570c9b699f3d258" ON "ADMIN_INVITATIONS" ("status") `);
        await queryRunner.query(`CREATE INDEX "IDX_34704d5eabfe4f1664250dc3b1" ON "ADMIN_INVITATIONS" ("email") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_5f47b61c5ca2e938352ed82c35" ON "ADMIN_INVITATIONS" ("inviteToken") `);
        await queryRunner.query(`ALTER TABLE "ADMIN_INVITATIONS" ADD CONSTRAINT "FK_913269e148a9833a02d1d6326ee" FOREIGN KEY ("invitedBy") REFERENCES "ADMIN_USERS"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ADMIN_INVITATIONS" DROP CONSTRAINT "FK_913269e148a9833a02d1d6326ee"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5f47b61c5ca2e938352ed82c35"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_34704d5eabfe4f1664250dc3b1"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5b897574caa570c9b699f3d258"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_3afad0f7351fd52803b4d9c391"`);
        await queryRunner.query(`DROP TABLE "ADMIN_INVITATIONS"`);
        await queryRunner.query(`DROP TYPE "public"."ADMIN_INVITATIONS_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."ADMIN_INVITATIONS_role_enum"`);
    }

}
