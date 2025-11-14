import { MigrationInterface, QueryRunner } from "typeorm";

export class SupportXtransaction1763054353403 implements MigrationInterface {
    name = 'SupportXtransaction1763054353403'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."SUPPORT_TICKETS_category_enum" AS ENUM('technical', 'billing', 'account', 'loan', 'general', 'transaction')`);
        await queryRunner.query(`CREATE TYPE "public"."SUPPORT_TICKETS_priority_enum" AS ENUM('low', 'medium', 'high', 'urgent')`);
        await queryRunner.query(`CREATE TYPE "public"."SUPPORT_TICKETS_status_enum" AS ENUM('open', 'in-progress', 'resolved', 'closed', 'escalated')`);
        await queryRunner.query(`CREATE TABLE "SUPPORT_TICKETS" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "ticketNumber" character varying(255) NOT NULL, "customerId" uuid NOT NULL, "customerName" character varying(255) NOT NULL, "customerPhone" character varying(255) NOT NULL, "customerEmail" character varying(255) NOT NULL, "subject" character varying(255) NOT NULL, "description" text NOT NULL, "category" "public"."SUPPORT_TICKETS_category_enum" NOT NULL, "priority" "public"."SUPPORT_TICKETS_priority_enum" NOT NULL, "status" "public"."SUPPORT_TICKETS_status_enum" NOT NULL, "assignedTo" character varying(255), "assignedToName" character varying(255), "department" character varying(255), "escalatedTo" character varying(255), "escalatedToName" character varying(255), "resolution" text, "resolvedAt" TIMESTAMP, "resolvedBy" uuid, "lastMessageAt" TIMESTAMP, "messageCount" integer NOT NULL DEFAULT '0', "tags" text array, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_484cfe54646c9f478efd720b205" UNIQUE ("ticketNumber"), CONSTRAINT "PK_d7938e0ad222adbf0b1cc048203" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_bc04dae27cb3fde587dfafea55" ON "SUPPORT_TICKETS" ("createdAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_37d9e4521a7fe7f4155051a563" ON "SUPPORT_TICKETS" ("assignedTo") `);
        await queryRunner.query(`CREATE INDEX "IDX_ad388d50c478bdab04fd29c248" ON "SUPPORT_TICKETS" ("category") `);
        await queryRunner.query(`CREATE INDEX "IDX_6b9143abd0fa152fae81489179" ON "SUPPORT_TICKETS" ("priority") `);
        await queryRunner.query(`CREATE INDEX "IDX_0e204642ba27b8539fb1114d07" ON "SUPPORT_TICKETS" ("status") `);
        await queryRunner.query(`CREATE INDEX "IDX_13365c4d734d772090f2dc8354" ON "SUPPORT_TICKETS" ("customerId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_484cfe54646c9f478efd720b20" ON "SUPPORT_TICKETS" ("ticketNumber") `);
        await queryRunner.query(`CREATE TYPE "public"."TRANSACTIONS_type_enum" AS ENUM('airtime', 'repayment')`);
        await queryRunner.query(`CREATE TYPE "public"."TRANSACTIONS_status_enum" AS ENUM('completed', 'pending', 'failed', 'refunded')`);
        await queryRunner.query(`CREATE TYPE "public"."TRANSACTIONS_paymentmethod_enum" AS ENUM('bank_transfer', 'card', 'wallet', 'cash')`);
        await queryRunner.query(`CREATE TABLE "TRANSACTIONS" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "transactionId" character varying(255) NOT NULL, "userId" uuid NOT NULL, "userPhone" character varying(255) NOT NULL, "userEmail" character varying(255), "type" "public"."TRANSACTIONS_type_enum" NOT NULL, "amount" numeric(15,2) NOT NULL, "status" "public"."TRANSACTIONS_status_enum" NOT NULL, "paymentMethod" "public"."TRANSACTIONS_paymentmethod_enum", "description" text, "reference" character varying(255), "provider" character varying(255), "network" character varying(255), "reconciledAt" TIMESTAMP, "reconciledBy" uuid, "notes" text, "metadata" jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_2bc3db92643ab2ce313be81a172" UNIQUE ("transactionId"), CONSTRAINT "PK_84b6fce7dbd55ee3118865224c4" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_62271b1657120d93e3e4afa2f1" ON "TRANSACTIONS" ("reference") `);
        await queryRunner.query(`CREATE INDEX "IDX_9ac887b5b7c1eb4029b293fe6c" ON "TRANSACTIONS" ("createdAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_b06788af2b4aab4ec26a579cd8" ON "TRANSACTIONS" ("status") `);
        await queryRunner.query(`CREATE INDEX "IDX_a891e79d0e73bb3907af85f24d" ON "TRANSACTIONS" ("type") `);
        await queryRunner.query(`CREATE INDEX "IDX_3284b0ccc43fe0f3073df7f03c" ON "TRANSACTIONS" ("userId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_2bc3db92643ab2ce313be81a17" ON "TRANSACTIONS" ("transactionId") `);
        await queryRunner.query(`CREATE TABLE "TICKET_HISTORY" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "ticketId" uuid NOT NULL, "action" character varying(255) NOT NULL, "performedBy" uuid NOT NULL, "performedByName" character varying(255) NOT NULL, "details" text, "timestamp" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_494111d6dd31491dba105f44b55" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_69aeab6d0e6bee276abd1c4239" ON "TICKET_HISTORY" ("timestamp") `);
        await queryRunner.query(`CREATE INDEX "IDX_caf2a55093da52a69e566a8d92" ON "TICKET_HISTORY" ("performedBy") `);
        await queryRunner.query(`CREATE INDEX "IDX_9333e725d74f1b3cf939e3129b" ON "TICKET_HISTORY" ("ticketId") `);
        await queryRunner.query(`CREATE TYPE "public"."SUPPORT_AGENTS_status_enum" AS ENUM('available', 'busy', 'away')`);
        await queryRunner.query(`CREATE TABLE "SUPPORT_AGENTS" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(255) NOT NULL, "email" character varying(255) NOT NULL, "phone" character varying(255) NOT NULL, "department" character varying(255) NOT NULL, "tier" integer NOT NULL, "activeTickets" integer NOT NULL DEFAULT '0', "status" "public"."SUPPORT_AGENTS_status_enum" NOT NULL, CONSTRAINT "UQ_0976cfb2b34ec228171f47b2e92" UNIQUE ("email"), CONSTRAINT "PK_74011d78c9612006467f1c855fc" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_95facdb483430bb3ae5392feb3" ON "SUPPORT_AGENTS" ("status") `);
        await queryRunner.query(`CREATE INDEX "IDX_3b5c5dc089675f416be256962b" ON "SUPPORT_AGENTS" ("department") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_0976cfb2b34ec228171f47b2e9" ON "SUPPORT_AGENTS" ("email") `);
        await queryRunner.query(`CREATE TABLE "DEPARTMENTS" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(255) NOT NULL, "description" text NOT NULL, "tier" integer NOT NULL, "agentCount" integer NOT NULL DEFAULT '0', CONSTRAINT "PK_33f45fe50341df24bfb20cc1d34" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."CHAT_MESSAGES_sendertype_enum" AS ENUM('customer', 'agent', 'system')`);
        await queryRunner.query(`CREATE TABLE "CHAT_MESSAGES" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "ticketId" uuid NOT NULL, "senderId" character varying(255) NOT NULL, "senderName" character varying(255) NOT NULL, "senderType" "public"."CHAT_MESSAGES_sendertype_enum" NOT NULL, "message" text NOT NULL, "attachments" jsonb, "isRead" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_1b38a5239afa201c5a8a2fb50c6" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_6139f7bfbac3b28d40455ac786" ON "CHAT_MESSAGES" ("createdAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_d271c6e7abb890937f84d0774b" ON "CHAT_MESSAGES" ("senderId") `);
        await queryRunner.query(`CREATE INDEX "IDX_4ee5ad8ef7b402230e1b012144" ON "CHAT_MESSAGES" ("ticketId") `);
        await queryRunner.query(`ALTER TABLE "SUPPORT_TICKETS" ADD CONSTRAINT "FK_13365c4d734d772090f2dc83541" FOREIGN KEY ("customerId") REFERENCES "USERS"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "SUPPORT_TICKETS" ADD CONSTRAINT "FK_24bacc17042e606b3b9d1a537af" FOREIGN KEY ("resolvedBy") REFERENCES "ADMIN_USERS"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "TRANSACTIONS" ADD CONSTRAINT "FK_3284b0ccc43fe0f3073df7f03c8" FOREIGN KEY ("userId") REFERENCES "USERS"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "TRANSACTIONS" ADD CONSTRAINT "FK_4d9dd5a1de1d03de28abc29a686" FOREIGN KEY ("reconciledBy") REFERENCES "ADMIN_USERS"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "TICKET_HISTORY" ADD CONSTRAINT "FK_9333e725d74f1b3cf939e3129be" FOREIGN KEY ("ticketId") REFERENCES "SUPPORT_TICKETS"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "TICKET_HISTORY" ADD CONSTRAINT "FK_caf2a55093da52a69e566a8d925" FOREIGN KEY ("performedBy") REFERENCES "ADMIN_USERS"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "CHAT_MESSAGES" ADD CONSTRAINT "FK_4ee5ad8ef7b402230e1b012144c" FOREIGN KEY ("ticketId") REFERENCES "SUPPORT_TICKETS"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "CHAT_MESSAGES" DROP CONSTRAINT "FK_4ee5ad8ef7b402230e1b012144c"`);
        await queryRunner.query(`ALTER TABLE "TICKET_HISTORY" DROP CONSTRAINT "FK_caf2a55093da52a69e566a8d925"`);
        await queryRunner.query(`ALTER TABLE "TICKET_HISTORY" DROP CONSTRAINT "FK_9333e725d74f1b3cf939e3129be"`);
        await queryRunner.query(`ALTER TABLE "TRANSACTIONS" DROP CONSTRAINT "FK_4d9dd5a1de1d03de28abc29a686"`);
        await queryRunner.query(`ALTER TABLE "TRANSACTIONS" DROP CONSTRAINT "FK_3284b0ccc43fe0f3073df7f03c8"`);
        await queryRunner.query(`ALTER TABLE "SUPPORT_TICKETS" DROP CONSTRAINT "FK_24bacc17042e606b3b9d1a537af"`);
        await queryRunner.query(`ALTER TABLE "SUPPORT_TICKETS" DROP CONSTRAINT "FK_13365c4d734d772090f2dc83541"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_4ee5ad8ef7b402230e1b012144"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d271c6e7abb890937f84d0774b"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_6139f7bfbac3b28d40455ac786"`);
        await queryRunner.query(`DROP TABLE "CHAT_MESSAGES"`);
        await queryRunner.query(`DROP TYPE "public"."CHAT_MESSAGES_sendertype_enum"`);
        await queryRunner.query(`DROP TABLE "DEPARTMENTS"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0976cfb2b34ec228171f47b2e9"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_3b5c5dc089675f416be256962b"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_95facdb483430bb3ae5392feb3"`);
        await queryRunner.query(`DROP TABLE "SUPPORT_AGENTS"`);
        await queryRunner.query(`DROP TYPE "public"."SUPPORT_AGENTS_status_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9333e725d74f1b3cf939e3129b"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_caf2a55093da52a69e566a8d92"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_69aeab6d0e6bee276abd1c4239"`);
        await queryRunner.query(`DROP TABLE "TICKET_HISTORY"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2bc3db92643ab2ce313be81a17"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_3284b0ccc43fe0f3073df7f03c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a891e79d0e73bb3907af85f24d"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b06788af2b4aab4ec26a579cd8"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9ac887b5b7c1eb4029b293fe6c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_62271b1657120d93e3e4afa2f1"`);
        await queryRunner.query(`DROP TABLE "TRANSACTIONS"`);
        await queryRunner.query(`DROP TYPE "public"."TRANSACTIONS_paymentmethod_enum"`);
        await queryRunner.query(`DROP TYPE "public"."TRANSACTIONS_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."TRANSACTIONS_type_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_484cfe54646c9f478efd720b20"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_13365c4d734d772090f2dc8354"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0e204642ba27b8539fb1114d07"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_6b9143abd0fa152fae81489179"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ad388d50c478bdab04fd29c248"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_37d9e4521a7fe7f4155051a563"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_bc04dae27cb3fde587dfafea55"`);
        await queryRunner.query(`DROP TABLE "SUPPORT_TICKETS"`);
        await queryRunner.query(`DROP TYPE "public"."SUPPORT_TICKETS_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."SUPPORT_TICKETS_priority_enum"`);
        await queryRunner.query(`DROP TYPE "public"."SUPPORT_TICKETS_category_enum"`);
    }

}
