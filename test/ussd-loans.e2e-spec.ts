import request from 'supertest';
import { initTestApp, closeTestApp, TestApp } from './utils/test-app';
import { User, UserStatus, RepaymentStatus } from '../src/entities/user.entity';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

describe('UssdLoansController (e2e)', () => {
    let testApp: TestApp;
    let userRepo: Repository<User>;
    let testUser: User;

    beforeAll(async () => {
        testApp = await initTestApp();
        if (!testApp.dataSource) {
            throw new Error('Test data source not initialized');
        }
        userRepo = testApp.dataSource.getRepository(User);

        // Create a test user
        // Ensure we don't have a conflict, although uuid should be safe
        testUser = userRepo.create({
            userId: uuidv4(),
            phone: '+2348012345678',
            email: `test-${uuidv4()}@example.com`,
            creditScore: 700,
            creditLimit: 50000,
            status: UserStatus.ACTIVE,
            repaymentStatus: RepaymentStatus.PENDING,
            totalRepaid: 10000,
            totalLoans: 1,
            autoLimitEnabled: true,
        });
        await userRepo.save(testUser);
    }, 30000);

    afterAll(async () => {
        if (testUser && userRepo) {
            await userRepo.remove(testUser);
        }
        await closeTestApp(testApp);
    }, 30000);

    describe('/ussd/loan-offer (POST)', () => {
        it('should return offers in JSON format', async () => {
            const payload = {
                phoneNumber: testUser.phone,
                sessionId: 'sess-123',
                responseType: 'json',
                network: 'mtn',
                channel: 'USSD'
            };

            const response = await request(testApp.httpServer)
                .post('/ussd/loan-offer')
                .send(payload)
                .expect(201);

            expect(response.body).toHaveProperty('status', 'success');
            expect(response.body).toHaveProperty('offers');
            expect(Array.isArray(response.body.offers)).toBe(true);
            // Depending on credit score logic, we expect some offers
            // If logic is strict, we might get NO_OFFERS, but with 700 score/50k limit, we expect offers
            if (response.body.status === 'success') {
                expect(response.body.offers.length).toBeGreaterThan(0);
            }
        });

        it('should return offers in Text format', async () => {
            const payload = {
                phoneNumber: testUser.phone,
                sessionId: 'sess-123',
                responseType: 'text',
                network: 'mtn',
                channel: 'USSD'
            };

            const response = await request(testApp.httpServer)
                .post('/ussd/loan-offer')
                .send(payload)
                .expect(201);

            expect(typeof response.text).toBe('string');
            expect(response.text).toContain('CON');
        });

        it('should return error for invalid user', async () => {
            const payload = {
                phoneNumber: '+0000000000',
                sessionId: 'sess-123',
                responseType: 'json',
            };

            const response = await request(testApp.httpServer)
                .post('/ussd/loan-offer')
                .send(payload)
                .expect(201);

            expect(response.body).toHaveProperty('status', 'error');
            expect(response.body.code).toBe('USER_NOT_FOUND');
        });
    });

    describe('/ussd/loan-approve (POST)', () => {
        let validOption = 1;
        let validAmount = 0;

        beforeAll(async () => {
            // Get offers first to ensure we have a valid session/option
            const payload = {
                phoneNumber: testUser.phone,
                sessionId: 'sess-approve-123',
                responseType: 'json',
            };
            const res = await request(testApp.httpServer)
                .post('/ussd/loan-offer')
                .send(payload);

            if (res.body.offers && res.body.offers.length > 0) {
                validOption = res.body.offers[0].option;
                validAmount = res.body.offers[0].amount;
            }
        });

        it('should approve loan and return processing status (JSON)', async () => {
            const payload = {
                phoneNumber: testUser.phone,
                sessionId: 'sess-approve-123',
                selectedOption: String(validOption),
                responseType: 'json',
                network: 'mtn'
            };

            const response = await request(testApp.httpServer)
                .post('/ussd/loan-approve')
                .send(payload)
                .expect(201);

            expect(response.body).toHaveProperty('status', 'processing');
            expect(response.body).toHaveProperty('loan');
            expect(response.body.loan).toHaveProperty('status', 'APPROVED');
        });

        it('should return error for invalid selection', async () => {
            const payload = {
                phoneNumber: testUser.phone,
                sessionId: 'sess-approve-123',
                selectedOption: '999', // Invalid option
                responseType: 'json',
                network: 'mtn'
            };

            const response = await request(testApp.httpServer)
                .post('/ussd/loan-approve')
                .send(payload)
                .expect(201);

            expect(response.body).toHaveProperty('status', 'error');
            // Code might be INVALID_SELECTION or similar
        });
    });
});
