import { MigrationInterface, QueryRunner } from "typeorm";

export class TicketChanges1763489678311 implements MigrationInterface {
    name = 'TicketChanges1763489678311'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "SUPPORT_TICKETS" DROP CONSTRAINT "FK_13365c4d734d772090f2dc83541"`);
        await queryRunner.query(`ALTER TABLE "SUPPORT_TICKETS" ALTER COLUMN "customerId" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "SUPPORT_TICKETS" ALTER COLUMN "customerName" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "SUPPORT_TICKETS" ALTER COLUMN "customerPhone" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "SUPPORT_TICKETS" ALTER COLUMN "customerEmail" DROP NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "SUPPORT_TICKETS" ALTER COLUMN "customerEmail" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "SUPPORT_TICKETS" ALTER COLUMN "customerPhone" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "SUPPORT_TICKETS" ALTER COLUMN "customerName" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "SUPPORT_TICKETS" ALTER COLUMN "customerId" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "SUPPORT_TICKETS" ADD CONSTRAINT "FK_13365c4d734d772090f2dc83541" FOREIGN KEY ("customerId") REFERENCES "USERS"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}
