import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialMigration1763036822392 implements MigrationInterface {
    name = 'InitialMigration1763036822392'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."USERS_repaymentstatus_enum" AS ENUM('Partial', 'Completed', 'Overdue', 'Pending')`);
        await queryRunner.query(`CREATE TYPE "public"."USERS_status_enum" AS ENUM('active', 'inactive', 'suspended')`);
        await queryRunner.query(`CREATE TABLE "USERS" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" character varying(255) NOT NULL, "phone" character varying(255) NOT NULL, "email" character varying(255), "creditScore" integer NOT NULL DEFAULT '0', "repaymentStatus" "public"."USERS_repaymentstatus_enum" NOT NULL DEFAULT 'Pending', "totalRepaid" numeric(15,2) NOT NULL DEFAULT '0', "status" "public"."USERS_status_enum" NOT NULL DEFAULT 'active', "creditLimit" numeric(15,2) NOT NULL DEFAULT '0', "autoLimitEnabled" boolean NOT NULL DEFAULT false, "totalLoans" integer, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_20e6bc36f8dd794f59be7037fec" UNIQUE ("userId"), CONSTRAINT "PK_b16c39a00c89083529c6166fa5b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_1b6eb0d93e4e92a0c893dbd5e7" ON "USERS" ("status") `);
        await queryRunner.query(`CREATE INDEX "IDX_a1689164dbbcca860ce6d17b2e" ON "USERS" ("email") `);
        await queryRunner.query(`CREATE INDEX "IDX_16348a64640625de02abc838e3" ON "USERS" ("phone") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_20e6bc36f8dd794f59be7037fe" ON "USERS" ("userId") `);
        await queryRunner.query(`CREATE TABLE "ADMIN_ROLES" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(255) NOT NULL, "description" text, "permissions" jsonb NOT NULL, "userCount" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_18406753e0096a98945cc0fbcf5" UNIQUE ("name"), CONSTRAINT "PK_7bb6f5e39b2cbed2fdf9aa95631" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_18406753e0096a98945cc0fbcf" ON "ADMIN_ROLES" ("name") `);
        await queryRunner.query(`CREATE TYPE "public"."ADMIN_USERS_status_enum" AS ENUM('active', 'inactive', 'suspended')`);
        await queryRunner.query(`CREATE TABLE "ADMIN_USERS" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "username" character varying(255) NOT NULL, "email" character varying(255) NOT NULL, "password" character varying(255) NOT NULL, "role" character varying(255), "roleId" uuid NOT NULL, "status" "public"."ADMIN_USERS_status_enum" NOT NULL DEFAULT 'active', "lastLogin" TIMESTAMP, "twoFactorEnabled" boolean NOT NULL DEFAULT false, "otpSecret" character varying(255), "refreshToken" character varying(255), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "createdBy" uuid, CONSTRAINT "UQ_f7763a9331fe2457cc25ff34f1a" UNIQUE ("username"), CONSTRAINT "UQ_0b94dac62e5b213ce9c65601a0f" UNIQUE ("email"), CONSTRAINT "PK_39f88dd62f86c8b0f2b6f147ea9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_877c7c91b4d47bb4b006cc9341" ON "ADMIN_USERS" ("status") `);
        await queryRunner.query(`CREATE INDEX "IDX_a1ee99d79b22f3e82af69a352b" ON "ADMIN_USERS" ("roleId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_0b94dac62e5b213ce9c65601a0" ON "ADMIN_USERS" ("email") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_f7763a9331fe2457cc25ff34f1" ON "ADMIN_USERS" ("username") `);
        await queryRunner.query(`CREATE TYPE "public"."LOANS_status_enum" AS ENUM('pending', 'approved', 'rejected', 'disbursed', 'repaying', 'completed', 'defaulted')`);
        await queryRunner.query(`CREATE TYPE "public"."LOANS_network_enum" AS ENUM('MTN', 'Airtel', 'Glo', '9mobile')`);
        await queryRunner.query(`CREATE TABLE "LOANS" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "loanId" character varying(255) NOT NULL, "userId" uuid NOT NULL, "userPhone" character varying(255) NOT NULL, "userEmail" character varying(255), "amount" numeric(15,2) NOT NULL, "status" "public"."LOANS_status_enum" NOT NULL DEFAULT 'pending', "network" "public"."LOANS_network_enum" NOT NULL, "interestRate" numeric(5,2) NOT NULL, "repaymentPeriod" integer NOT NULL, "dueDate" TIMESTAMP NOT NULL, "amountDue" numeric(15,2) NOT NULL, "amountPaid" numeric(15,2) NOT NULL DEFAULT '0', "outstandingAmount" numeric(15,2) NOT NULL, "approvedAt" TIMESTAMP, "approvedBy" uuid, "rejectedAt" TIMESTAMP, "rejectedBy" uuid, "rejectionReason" text, "disbursedAt" TIMESTAMP, "completedAt" TIMESTAMP, "defaultedAt" TIMESTAMP, "telcoReference" character varying(255), "metadata" jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_26b3926b04ebd892d773727c348" UNIQUE ("loanId"), CONSTRAINT "PK_9fbe04c3f9b856bb5adfbf0a65f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_4dc2e5ae86c397607f4c05a3e5" ON "LOANS" ("createdAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_0eeb626a179505e5b9a76b315c" ON "LOANS" ("dueDate") `);
        await queryRunner.query(`CREATE INDEX "IDX_a33d15c16666b65647438da8ba" ON "LOANS" ("network") `);
        await queryRunner.query(`CREATE INDEX "IDX_5896296575f0ea518b037ab111" ON "LOANS" ("status") `);
        await queryRunner.query(`CREATE INDEX "IDX_8538f12975df65541cccf6d989" ON "LOANS" ("userId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_26b3926b04ebd892d773727c34" ON "LOANS" ("loanId") `);
        await queryRunner.query(`CREATE TABLE "BACKUP_CODES" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "adminUserId" uuid NOT NULL, "codeHash" character varying(255) NOT NULL, "used" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_fa4ddd9ab533ae56dc74956b48b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_b980d597f2623fec83fcfde8a2" ON "BACKUP_CODES" ("adminUserId", "used") `);
        await queryRunner.query(`CREATE TABLE "PENDING_LOGINS" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "adminUserId" uuid NOT NULL, "hash" character varying(255) NOT NULL, "type" character varying(16) NOT NULL, "expiresAt" TIMESTAMP NOT NULL, "attempts" integer NOT NULL DEFAULT '0', "used" boolean NOT NULL DEFAULT false, "secret" character varying(255), "ip" character varying(255), "userAgent" character varying(255), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_11f9c58b9c96927f14d6c2ea533" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_73db50e0d0083ce5f5402e846d" ON "PENDING_LOGINS" ("adminUserId", "type", "used") `);
        await queryRunner.query(`ALTER TABLE "ADMIN_USERS" ADD CONSTRAINT "FK_a1ee99d79b22f3e82af69a352b1" FOREIGN KEY ("roleId") REFERENCES "ADMIN_ROLES"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "ADMIN_USERS" ADD CONSTRAINT "FK_76c13c93dff6e1c8b1b7d0b921c" FOREIGN KEY ("createdBy") REFERENCES "ADMIN_USERS"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "LOANS" ADD CONSTRAINT "FK_8538f12975df65541cccf6d9892" FOREIGN KEY ("userId") REFERENCES "USERS"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "LOANS" ADD CONSTRAINT "FK_6793d089e01da3a1fcc40061b8f" FOREIGN KEY ("approvedBy") REFERENCES "ADMIN_USERS"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "LOANS" ADD CONSTRAINT "FK_3fec8d7c24daa0f33c58411fced" FOREIGN KEY ("rejectedBy") REFERENCES "ADMIN_USERS"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "BACKUP_CODES" ADD CONSTRAINT "FK_0536acc4c88c5ae7bf0cbec02e4" FOREIGN KEY ("adminUserId") REFERENCES "ADMIN_USERS"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "PENDING_LOGINS" ADD CONSTRAINT "FK_c223cea3c11eb6b551e79fb8a35" FOREIGN KEY ("adminUserId") REFERENCES "ADMIN_USERS"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "PENDING_LOGINS" DROP CONSTRAINT "FK_c223cea3c11eb6b551e79fb8a35"`);
        await queryRunner.query(`ALTER TABLE "BACKUP_CODES" DROP CONSTRAINT "FK_0536acc4c88c5ae7bf0cbec02e4"`);
        await queryRunner.query(`ALTER TABLE "LOANS" DROP CONSTRAINT "FK_3fec8d7c24daa0f33c58411fced"`);
        await queryRunner.query(`ALTER TABLE "LOANS" DROP CONSTRAINT "FK_6793d089e01da3a1fcc40061b8f"`);
        await queryRunner.query(`ALTER TABLE "LOANS" DROP CONSTRAINT "FK_8538f12975df65541cccf6d9892"`);
        await queryRunner.query(`ALTER TABLE "ADMIN_USERS" DROP CONSTRAINT "FK_76c13c93dff6e1c8b1b7d0b921c"`);
        await queryRunner.query(`ALTER TABLE "ADMIN_USERS" DROP CONSTRAINT "FK_a1ee99d79b22f3e82af69a352b1"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_73db50e0d0083ce5f5402e846d"`);
        await queryRunner.query(`DROP TABLE "PENDING_LOGINS"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b980d597f2623fec83fcfde8a2"`);
        await queryRunner.query(`DROP TABLE "BACKUP_CODES"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_26b3926b04ebd892d773727c34"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8538f12975df65541cccf6d989"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5896296575f0ea518b037ab111"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a33d15c16666b65647438da8ba"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0eeb626a179505e5b9a76b315c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_4dc2e5ae86c397607f4c05a3e5"`);
        await queryRunner.query(`DROP TABLE "LOANS"`);
        await queryRunner.query(`DROP TYPE "public"."LOANS_network_enum"`);
        await queryRunner.query(`DROP TYPE "public"."LOANS_status_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f7763a9331fe2457cc25ff34f1"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0b94dac62e5b213ce9c65601a0"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a1ee99d79b22f3e82af69a352b"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_877c7c91b4d47bb4b006cc9341"`);
        await queryRunner.query(`DROP TABLE "ADMIN_USERS"`);
        await queryRunner.query(`DROP TYPE "public"."ADMIN_USERS_status_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_18406753e0096a98945cc0fbcf"`);
        await queryRunner.query(`DROP TABLE "ADMIN_ROLES"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_20e6bc36f8dd794f59be7037fe"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_16348a64640625de02abc838e3"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a1689164dbbcca860ce6d17b2e"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1b6eb0d93e4e92a0c893dbd5e7"`);
        await queryRunner.query(`DROP TABLE "USERS"`);
        await queryRunner.query(`DROP TYPE "public"."USERS_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."USERS_repaymentstatus_enum"`);
    }

}
