import { MigrationInterface, QueryRunner } from "typeorm";

export class AddRoleIdToAdminInvitations1763294256029 implements MigrationInterface {
    name = 'AddRoleIdToAdminInvitations1763294256029'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ADMIN_INVITATIONS" ADD "roleId" uuid`);
        await queryRunner.query(`ALTER TABLE "ADMIN_INVITATIONS" ALTER COLUMN "role" DROP NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ADMIN_INVITATIONS" ALTER COLUMN "role" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "ADMIN_INVITATIONS" DROP COLUMN "roleId"`);
    }

}
