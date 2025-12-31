import request from 'supertest';
import { initTestApp, closeTestApp, TestApp } from './utils/test-app';
import { loginSeedAdmin, getAuthHeaders } from './utils/auth';
import { User, UserStatus, RepaymentStatus } from '../src/entities/user.entity';
import { Loan, LoanStatus, Network } from '../src/entities/loan.entity';
import { Repository, DataSource } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

/**
 * MNO Endpoints Test Script
 * 
 * This script tests all MNO endpoints in sequence to simulate a complete walkthrough:
 * 1. Eligibility API - Check subscriber eligibility
 * 2. Fulfillment API - Process loan disbursement
 * 3. Repayment API - Process loan repayment
 * 4. Loan Enquiry API - Query outstanding loans
 * 
 * Usage:
 *   npm run test:e2e -- mno-endpoints.e2e-spec.ts
 *   or
 *   ./test-mno-endpoints.sh
 */

interface TestResults {
  endpoint: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  statusCode?: number;
  message: string;
  error?: string;
  response?: any;
}

class MnoEndpointsTester {
  private testApp: TestApp;
  private userRepo: Repository<User>;
  private loanRepo: Repository<Loan>;
  private testUser: User;
  private apiKey: string;
  private adminToken: string;
  private testResults: TestResults[] = [];
  private createdLoanId: string | null = null;

  async setup(): Promise<void> {
    console.log('\n🔧 Setting up test environment...\n');

    // Initialize test app
    this.testApp = await initTestApp();
    
    // Get DataSource - use the one from testApp
    if (!this.testApp.dataSource) {
      throw new Error('Test app did not return a DataSource');
    }

    const dataSource = this.testApp.dataSource;

    // Verify DataSource is initialized
    if (!dataSource.isInitialized) {
      console.error('DataSource state:', {
        isInitialized: dataSource.isInitialized,
        driver: dataSource.driver ? 'exists' : 'missing',
      });
      throw new Error('DataSource from initTestApp is not initialized');
    }

    this.userRepo = dataSource.getRepository(User);
    this.loanRepo = dataSource.getRepository(Loan);

    // Login as admin to create API key
    const authResult = await loginSeedAdmin(this.testApp.httpServer);
    this.adminToken = authResult.token;

    // Create test user
    const testPhone = `+23480${Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}`;
    this.testUser = this.userRepo.create({
      userId: uuidv4(),
      phone: testPhone,
      email: `mno-test-${uuidv4()}@example.com`,
      creditScore: 750,
      creditLimit: 50000,
      status: UserStatus.ACTIVE,
      repaymentStatus: RepaymentStatus.PENDING,
      totalRepaid: 0,
      totalLoans: 0,
      autoLimitEnabled: true,
    });
    await this.userRepo.save(this.testUser);
    console.log(`✅ Created test user: ${this.testUser.phone} (${this.testUser.userId})`);

    // Create API key
    const apiKeyResponse = await request(this.testApp.httpServer)
      .post('/admin/api-keys')
      .set(getAuthHeaders(this.adminToken))
      .send({
        name: 'MNO Test API Key',
        email: `mno-test-${uuidv4()}@example.com`,
        description: 'API key for MNO endpoints testing',
      })
      .expect(201);

    this.apiKey = apiKeyResponse.body.token;
    console.log(`✅ Created API key: ${apiKeyResponse.body.id.substring(0, 8)}...`);

    console.log('\n✅ Setup complete!\n');
  }

  private recordResult(result: TestResults): void {
    this.testResults.push(result);
    const icon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⏭️';
    console.log(`${icon} ${result.endpoint}`);
    console.log(`   Status: ${result.statusCode || 'N/A'} | ${result.message}`);
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
    if (result.response && result.status === 'FAIL') {
      console.log(`   Response: ${JSON.stringify(result.response, null, 2)}`);
    }
    console.log('');
  }

  private getApiKeyHeaders() {
    return {
      'x-api-token': this.apiKey,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Test 1: Eligibility API
   * POST /mno/eligibility
   */
  async testEligibility(): Promise<void> {
    console.log('📋 Testing Eligibility API...\n');

    const requestId = `req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const payload = {
      phoneNumber: this.testUser.phone,
      network: Network.AIRTEL,
      requestId,
    };

    try {
      const response = await request(this.testApp.httpServer)
        .post('/mno/eligibility')
        .set(this.getApiKeyHeaders())
        .send(payload);

      if (response.status === 200 && response.body.status === 'success') {
        this.recordResult({
          endpoint: 'POST /mno/eligibility',
          status: 'PASS',
          statusCode: response.status,
          message: `Eligible amount: ${response.body.eligibleAmount} NGN, Credit score: ${response.body.creditScore}`,
          response: response.body,
        });
      } else {
        this.recordResult({
          endpoint: 'POST /mno/eligibility',
          status: 'FAIL',
          statusCode: response.status,
          message: `Unexpected response: ${response.body.status}`,
          error: response.body.message || response.body.errorCode,
          response: response.body,
        });
      }
    } catch (error) {
      this.recordResult({
        endpoint: 'POST /mno/eligibility',
        status: 'FAIL',
        message: 'Request failed',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Test 2: Create a loan for fulfillment/repayment tests
   * This simulates a loan that was approved after eligibility check
   */
  async createTestLoan(): Promise<void> {
    console.log('📋 Creating test loan for fulfillment/repayment tests...\n');

    try {
      // Create a loan in APPROVED status (ready for fulfillment)
      const loanId = `loan-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const loanAmount = 10000;
      const interestRate = 5;
      const repaymentPeriod = 30;

      const loan = this.loanRepo.create({
        loanId,
        userId: this.testUser.id,
        userPhone: this.testUser.phone,
        userEmail: this.testUser.email,
        amount: loanAmount,
        disbursedAmount: loanAmount * (1 - interestRate / 100),
        status: LoanStatus.APPROVED,
        network: Network.AIRTEL,
        interestRate,
        repaymentPeriod,
        amountDue: loanAmount,
        amountPaid: 0,
        outstandingAmount: loanAmount,
        dueDate: new Date(Date.now() + repaymentPeriod * 24 * 60 * 60 * 1000),
        approvedAt: new Date(),
        approvedBy: null,
      });

      const savedLoan = await this.loanRepo.save(loan);
      this.createdLoanId = savedLoan.id;

      this.recordResult({
        endpoint: 'CREATE TEST LOAN',
        status: 'PASS',
        message: `Created loan ${loanId} with amount ${loanAmount} NGN`,
      });
    } catch (error) {
      this.recordResult({
        endpoint: 'CREATE TEST LOAN',
        status: 'FAIL',
        message: 'Failed to create test loan',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Test 3: Fulfillment API
   * POST /mno/fulfillment
   */
  async testFulfillment(): Promise<void> {
    console.log('📋 Testing Fulfillment API...\n');

    if (!this.createdLoanId) {
      this.recordResult({
        endpoint: 'POST /mno/fulfillment',
        status: 'SKIP',
        message: 'Skipped - no test loan created',
      });
      return;
    }

    const loan = await this.loanRepo.findOne({
      where: { id: this.createdLoanId },
    });

    if (!loan) {
      this.recordResult({
        endpoint: 'POST /mno/fulfillment',
        status: 'FAIL',
        message: 'Test loan not found',
      });
      return;
    }

    const requestId = `req-fulfill-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const payload = {
      phoneNumber: this.testUser.phone,
      loanId: loan.id,
      amount: loan.amount,
      network: Network.AIRTEL,
      transactionReference: `txn-fulfill-${Date.now()}`,
      disbursedAt: new Date().toISOString(),
      requestId,
    };

    try {
      const response = await request(this.testApp.httpServer)
        .post('/mno/fulfillment')
        .set(this.getApiKeyHeaders())
        .send(payload);

      if (response.status === 200 && response.body.status === 'success') {
        // Verify loan status was updated
        const updatedLoan = await this.loanRepo.findOne({
          where: { id: loan.id },
        });

        this.recordResult({
          endpoint: 'POST /mno/fulfillment',
          status: 'PASS',
          statusCode: response.status,
          message: `Fulfillment processed. Loan status: ${updatedLoan?.status}`,
          response: response.body,
        });
      } else {
        this.recordResult({
          endpoint: 'POST /mno/fulfillment',
          status: 'FAIL',
          statusCode: response.status,
          message: `Unexpected response: ${response.body.status}`,
          error: response.body.message || response.body.errorCode,
          response: response.body,
        });
      }
    } catch (error) {
      this.recordResult({
        endpoint: 'POST /mno/fulfillment',
        status: 'FAIL',
        message: 'Request failed',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Test 4: Repayment API
   * POST /mno/repayment
   */
  async testRepayment(): Promise<void> {
    console.log('📋 Testing Repayment API...\n');

    if (!this.createdLoanId) {
      this.recordResult({
        endpoint: 'POST /mno/repayment',
        status: 'SKIP',
        message: 'Skipped - no test loan created',
      });
      return;
    }

    const loan = await this.loanRepo.findOne({
      where: { id: this.createdLoanId },
    });

    if (!loan) {
      this.recordResult({
        endpoint: 'POST /mno/repayment',
        status: 'FAIL',
        message: 'Test loan not found',
      });
      return;
    }

    // Ensure loan is in a state that can accept repayments
    if (loan.status !== LoanStatus.DISBURSED && loan.status !== LoanStatus.REPAYING) {
      // Update loan to DISBURSED if needed
      loan.status = LoanStatus.DISBURSED;
      await this.loanRepo.save(loan);
    }

    const repaymentAmount = Math.min(5000, Number(loan.outstandingAmount || loan.amount));
    const requestId = `req-repay-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const payload = {
      phoneNumber: this.testUser.phone,
      loanId: loan.id,
      amount: repaymentAmount,
      network: Network.AIRTEL,
      transactionReference: `txn-repay-${Date.now()}`,
      repaidAt: new Date().toISOString(),
      requestId,
    };

    try {
      const response = await request(this.testApp.httpServer)
        .post('/mno/repayment')
        .set(this.getApiKeyHeaders())
        .send(payload);

      if (response.status === 200 && response.body.status === 'success') {
        // Verify loan was updated
        const updatedLoan = await this.loanRepo.findOne({
          where: { id: loan.id },
        });

        this.recordResult({
          endpoint: 'POST /mno/repayment',
          status: 'PASS',
          statusCode: response.status,
          message: `Repayment processed. Outstanding: ${updatedLoan?.outstandingAmount}, Status: ${updatedLoan?.status}`,
          response: response.body,
        });
      } else {
        this.recordResult({
          endpoint: 'POST /mno/repayment',
          status: 'FAIL',
          statusCode: response.status,
          message: `Unexpected response: ${response.body.status}`,
          error: response.body.message || response.body.errorCode,
          response: response.body,
        });
      }
    } catch (error) {
      this.recordResult({
        endpoint: 'POST /mno/repayment',
        status: 'FAIL',
        message: 'Request failed',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Test 5: Loan Enquiry API
   * GET /mno/loan-enquiry
   */
  async testLoanEnquiry(): Promise<void> {
    console.log('📋 Testing Loan Enquiry API...\n');

    try {
      const response = await request(this.testApp.httpServer)
        .get('/mno/loan-enquiry')
        .set(this.getApiKeyHeaders())
        .query({
          phoneNumber: this.testUser.phone,
          network: Network.AIRTEL,
        });

      if (response.status === 200 && response.body.status === 'success') {
        this.recordResult({
          endpoint: 'GET /mno/loan-enquiry',
          status: 'PASS',
          statusCode: response.status,
          message: `Found ${response.body.loans?.length || 0} active loans. Total outstanding: ${response.body.totalOutstandingAmount || 0} NGN`,
          response: response.body,
        });
      } else {
        this.recordResult({
          endpoint: 'GET /mno/loan-enquiry',
          status: 'FAIL',
          statusCode: response.status,
          message: `Unexpected response: ${response.body.status}`,
          error: response.body.message || response.body.errorCode,
          response: response.body,
        });
      }
    } catch (error) {
      this.recordResult({
        endpoint: 'GET /mno/loan-enquiry',
        status: 'FAIL',
        message: 'Request failed',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Test error cases
   */
  async testErrorCases(): Promise<void> {
    console.log('📋 Testing error cases...\n');

    // Test 1: Invalid phone number
    try {
      const response = await request(this.testApp.httpServer)
        .post('/mno/eligibility')
        .set(this.getApiKeyHeaders())
        .send({
          phoneNumber: 'invalid-phone',
          network: Network.AIRTEL,
        });

      if (response.status === 200 && response.body.status === 'error') {
        this.recordResult({
          endpoint: 'POST /mno/eligibility (invalid phone)',
          status: 'PASS',
          statusCode: response.status,
          message: 'Correctly rejected invalid phone number',
        });
      } else {
        this.recordResult({
          endpoint: 'POST /mno/eligibility (invalid phone)',
          status: 'FAIL',
          statusCode: response.status,
          message: 'Should have rejected invalid phone number',
          response: response.body,
        });
      }
    } catch (error) {
      this.recordResult({
        endpoint: 'POST /mno/eligibility (invalid phone)',
        status: 'FAIL',
        message: 'Request failed',
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Test 2: Missing API key
    try {
      const response = await request(this.testApp.httpServer)
        .post('/mno/eligibility')
        .send({
          phoneNumber: this.testUser.phone,
          network: Network.AIRTEL,
        });

      if (response.status === 401) {
        this.recordResult({
          endpoint: 'POST /mno/eligibility (no API key)',
          status: 'PASS',
          statusCode: response.status,
          message: 'Correctly rejected request without API key',
        });
      } else {
        this.recordResult({
          endpoint: 'POST /mno/eligibility (no API key)',
          status: 'FAIL',
          statusCode: response.status,
          message: 'Should have rejected request without API key',
          response: response.body,
        });
      }
    } catch (error) {
      this.recordResult({
        endpoint: 'POST /mno/eligibility (no API key)',
        status: 'FAIL',
        message: 'Request failed',
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Test 3: Non-existent user
    try {
      const response = await request(this.testApp.httpServer)
        .post('/mno/eligibility')
        .set(this.getApiKeyHeaders())
        .send({
          phoneNumber: '+2349999999999',
          network: Network.AIRTEL,
        });

      if (response.status === 200 && response.body.status === 'error' && response.body.errorCode === 'SUBSCRIBER_NOT_FOUND') {
        this.recordResult({
          endpoint: 'POST /mno/eligibility (non-existent user)',
          status: 'PASS',
          statusCode: response.status,
          message: 'Correctly handled non-existent user',
        });
      } else {
        this.recordResult({
          endpoint: 'POST /mno/eligibility (non-existent user)',
          status: 'FAIL',
          statusCode: response.status,
          message: 'Should have returned SUBSCRIBER_NOT_FOUND error',
          response: response.body,
        });
      }
    } catch (error) {
      this.recordResult({
        endpoint: 'POST /mno/eligibility (non-existent user)',
        status: 'FAIL',
        message: 'Request failed',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async cleanup(): Promise<void> {
    console.log('\n🧹 Cleaning up test data...\n');

    try {
      // Check if testApp exists and DataSource is still connected before cleanup
      if (this.testApp && this.testApp.dataSource && this.testApp.dataSource.isInitialized) {
        if (this.createdLoanId && this.loanRepo) {
          try {
            await this.loanRepo.delete({ id: this.createdLoanId });
            console.log('✅ Deleted test loan');
          } catch (error) {
            console.warn('⚠️  Could not delete test loan:', error instanceof Error ? error.message : String(error));
          }
        }

        if (this.testUser && this.userRepo) {
          try {
            await this.userRepo.remove(this.testUser);
            console.log('✅ Deleted test user');
          } catch (error) {
            console.warn('⚠️  Could not delete test user:', error instanceof Error ? error.message : String(error));
          }
        }
      } else {
        console.warn('⚠️  DataSource not initialized, skipping cleanup');
      }

      // Note: API key cleanup would require admin access, skipping for now
      console.log('✅ Cleanup complete\n');
    } catch (error) {
      console.error('❌ Error during cleanup:', error);
    }

    if (this.testApp) {
      await closeTestApp(this.testApp);
    }
  }

  printSummary(): void {
    console.log('\n' + '='.repeat(80));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(80) + '\n');

    const passed = this.testResults.filter((r) => r.status === 'PASS').length;
    const failed = this.testResults.filter((r) => r.status === 'FAIL').length;
    const skipped = this.testResults.filter((r) => r.status === 'SKIP').length;

    console.log(`Total Tests: ${this.testResults.length}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⏭️  Skipped: ${skipped}\n`);

    if (failed > 0) {
      console.log('❌ FAILED TESTS:\n');
      this.testResults
        .filter((r) => r.status === 'FAIL')
        .forEach((result) => {
          console.log(`  - ${result.endpoint}`);
          console.log(`    ${result.message}`);
          if (result.error) {
            console.log(`    Error: ${result.error}`);
          }
          console.log('');
        });
    }

    console.log('='.repeat(80) + '\n');
  }

  async runAllTests(): Promise<void> {
    try {
      await this.setup();

      // Run all tests in sequence
      await this.testEligibility();
      await this.createTestLoan();
      await this.testFulfillment();
      await this.testRepayment();
      await this.testLoanEnquiry();
      await this.testErrorCases();

      this.printSummary();
    } catch (error) {
      console.error('❌ Fatal error during test execution:', error);
      this.recordResult({
        endpoint: 'TEST EXECUTION',
        status: 'FAIL',
        message: 'Fatal error',
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      await this.cleanup();
    }
  }
}

// Run tests if executed directly
if (require.main === module) {
  const tester = new MnoEndpointsTester();
  tester.runAllTests().catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

// Export for Jest
describe('MNO Endpoints Integration Tests', () => {
  let tester: MnoEndpointsTester;

  beforeAll(async () => {
    tester = new MnoEndpointsTester();
    await tester.setup();
  }, 60000);

  test('Eligibility API', async () => {
    await tester.testEligibility();
  }, 30000);

  test('Create Test Loan', async () => {
    await tester.createTestLoan();
  }, 30000);

  test('Fulfillment API', async () => {
    await tester.testFulfillment();
  }, 30000);

  test('Repayment API', async () => {
    await tester.testRepayment();
  }, 30000);

  test('Loan Enquiry API', async () => {
    await tester.testLoanEnquiry();
  }, 30000);

  test('Error Cases', async () => {
    await tester.testErrorCases();
  }, 30000);

  afterAll(async () => {
    tester.printSummary();
    await tester.cleanup();
  }, 30000);
});

