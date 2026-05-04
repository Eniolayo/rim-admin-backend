import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSubscriberActivation1777925594280 implements MigrationInterface {
    name = 'AddSubscriberActivation1777925594280'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "csdp_subscriber" ADD "activated_at" date`);
        await queryRunner.query(`ALTER TABLE "csdp_subscriber" ADD "service_class_id" integer`);
        await queryRunner.query(`ALTER TABLE "csdp_cdr_refill" ADD "service_class" integer`);
        await queryRunner.query(`CREATE INDEX "IDX_32fbb8d9f5fdc0e16abd0c7ac9" ON "csdp_subscriber" ("activated_at") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_32fbb8d9f5fdc0e16abd0c7ac9"`);
        await queryRunner.query(`ALTER TABLE "csdp_cdr_refill" DROP COLUMN "service_class"`);
        await queryRunner.query(`ALTER TABLE "csdp_subscriber" DROP COLUMN "service_class_id"`);
        await queryRunner.query(`ALTER TABLE "csdp_subscriber" DROP COLUMN "activated_at"`);
    }

}
