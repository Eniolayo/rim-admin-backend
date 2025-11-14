import dataSource from '../data-source';
import { Loan, LoanStatus, Network } from '../../entities/loan.entity';
import { User } from '../../entities/user.entity';

interface LoanSeedData {
  loanId: string;
  userPhone: string;
  amount: number;
  status: LoanStatus;
  network: Network;
  interestRate: number;
  repaymentPeriod: number; // in days
  amountPaid: number;
  approvedAt: Date | null;
  rejectedAt: Date | null;
  completedAt: Date | null;
  defaultedAt: Date | null;
  telcoReference: string | null;
}

const loansToSeed: LoanSeedData[] = [
  {
    loanId: 'LOAN-001',
    userPhone: '08012345678',
    amount: 5000.0,
    status: LoanStatus.COMPLETED,
    network: Network.MTN,
    interestRate: 5.0,
    repaymentPeriod: 30,
    amountPaid: 5250.0,
    approvedAt: new Date('2024-01-15T10:00:00Z'),
    rejectedAt: null,
    completedAt: new Date('2024-02-14T10:00:00Z'),
    defaultedAt: null,
    telcoReference: 'TEL-001',
  },
  {
    loanId: 'LOAN-002',
    userPhone: '08023456789',
    amount: 10000.0,
    status: LoanStatus.REPAYING,
    network: Network.AIRTEL,
    interestRate: 7.5,
    repaymentPeriod: 30,
    amountPaid: 5000.0,
    approvedAt: new Date('2024-01-20T10:00:00Z'),
    rejectedAt: null,
    completedAt: null,
    defaultedAt: null,
    telcoReference: 'TEL-002',
  },
  {
    loanId: 'LOAN-003',
    userPhone: '08034567890',
    amount: 20000.0,
    status: LoanStatus.DISBURSED,
    network: Network.MTN,
    interestRate: 6.0,
    repaymentPeriod: 60,
    amountPaid: 0.0,
    approvedAt: new Date('2024-02-01T10:00:00Z'),
    rejectedAt: null,
    completedAt: null,
    defaultedAt: null,
    telcoReference: 'TEL-003',
  },
  {
    loanId: 'LOAN-004',
    userPhone: '08045678901',
    amount: 3000.0,
    status: LoanStatus.REJECTED,
    network: Network.GLO,
    interestRate: 8.0,
    repaymentPeriod: 30,
    amountPaid: 0.0,
    approvedAt: null,
    rejectedAt: new Date('2024-01-25T10:00:00Z'),
    completedAt: null,
    defaultedAt: null,
    telcoReference: null,
  },
  {
    loanId: 'LOAN-005',
    userPhone: '08056789012',
    amount: 15000.0,
    status: LoanStatus.PENDING,
    network: Network.MTN,
    interestRate: 5.5,
    repaymentPeriod: 30,
    amountPaid: 0.0,
    approvedAt: null,
    rejectedAt: null,
    completedAt: null,
    defaultedAt: null,
    telcoReference: null,
  },
  {
    loanId: 'LOAN-006',
    userPhone: '08067890123',
    amount: 25000.0,
    status: LoanStatus.COMPLETED,
    network: Network.AIRTEL,
    interestRate: 6.5,
    repaymentPeriod: 60,
    amountPaid: 26625.0,
    approvedAt: new Date('2024-01-10T10:00:00Z'),
    rejectedAt: null,
    completedAt: new Date('2024-03-10T10:00:00Z'),
    defaultedAt: null,
    telcoReference: 'TEL-006',
  },
  {
    loanId: 'LOAN-007',
    userPhone: '08078901234',
    amount: 8000.0,
    status: LoanStatus.DEFAULTED,
    network: Network.GLO,
    interestRate: 7.0,
    repaymentPeriod: 30,
    amountPaid: 2000.0,
    approvedAt: new Date('2024-01-05T10:00:00Z'),
    rejectedAt: null,
    completedAt: null,
    defaultedAt: new Date('2024-02-10T10:00:00Z'),
    telcoReference: 'TEL-007',
  },
  {
    loanId: 'LOAN-008',
    userPhone: '08089012345',
    amount: 12000.0,
    status: LoanStatus.REPAYING,
    network: Network.MTN,
    interestRate: 5.5,
    repaymentPeriod: 30,
    amountPaid: 6000.0,
    approvedAt: new Date('2024-02-05T10:00:00Z'),
    rejectedAt: null,
    completedAt: null,
    defaultedAt: null,
    telcoReference: 'TEL-008',
  },
  {
    loanId: 'LOAN-009',
    userPhone: '08090123456',
    amount: 30000.0,
    status: LoanStatus.COMPLETED,
    network: Network.AIRTEL,
    interestRate: 6.0,
    repaymentPeriod: 90,
    amountPaid: 31800.0,
    approvedAt: new Date('2023-12-01T10:00:00Z'),
    rejectedAt: null,
    completedAt: new Date('2024-03-01T10:00:00Z'),
    defaultedAt: null,
    telcoReference: 'TEL-009',
  },
  {
    loanId: 'LOAN-010',
    userPhone: '08101234567',
    amount: 5000.0,
    status: LoanStatus.APPROVED,
    network: Network.MTN,
    interestRate: 5.0,
    repaymentPeriod: 30,
    amountPaid: 0.0,
    approvedAt: new Date('2024-02-10T10:00:00Z'),
    rejectedAt: null,
    completedAt: null,
    defaultedAt: null,
    telcoReference: null,
  },
  {
    loanId: 'LOAN-011',
    userPhone: '08112345678',
    amount: 18000.0,
    status: LoanStatus.COMPLETED,
    network: Network.NINEMOBILE,
    interestRate: 6.5,
    repaymentPeriod: 30,
    amountPaid: 19170.0,
    approvedAt: new Date('2024-01-20T10:00:00Z'),
    rejectedAt: null,
    completedAt: new Date('2024-02-19T10:00:00Z'),
    defaultedAt: null,
    telcoReference: 'TEL-011',
  },
  {
    loanId: 'LOAN-012',
    userPhone: '08123456789',
    amount: 4000.0,
    status: LoanStatus.REJECTED,
    network: Network.GLO,
    interestRate: 8.5,
    repaymentPeriod: 30,
    amountPaid: 0.0,
    approvedAt: null,
    rejectedAt: new Date('2024-02-15T10:00:00Z'),
    completedAt: null,
    defaultedAt: null,
    telcoReference: null,
  },
  {
    loanId: 'LOAN-013',
    userPhone: '08134567890',
    amount: 50000.0,
    status: LoanStatus.COMPLETED,
    network: Network.MTN,
    interestRate: 5.5,
    repaymentPeriod: 60,
    amountPaid: 52750.0,
    approvedAt: new Date('2024-01-01T10:00:00Z'),
    rejectedAt: null,
    completedAt: new Date('2024-03-01T10:00:00Z'),
    defaultedAt: null,
    telcoReference: 'TEL-013',
  },
  {
    loanId: 'LOAN-014',
    userPhone: '08145678901',
    amount: 7000.0,
    status: LoanStatus.REPAYING,
    network: Network.AIRTEL,
    interestRate: 6.0,
    repaymentPeriod: 30,
    amountPaid: 3500.0,
    approvedAt: new Date('2024-02-01T10:00:00Z'),
    rejectedAt: null,
    completedAt: null,
    defaultedAt: null,
    telcoReference: 'TEL-014',
  },
  {
    loanId: 'LOAN-015',
    userPhone: '08156789012',
    amount: 22000.0,
    status: LoanStatus.COMPLETED,
    network: Network.MTN,
    interestRate: 6.0,
    repaymentPeriod: 30,
    amountPaid: 23320.0,
    approvedAt: new Date('2024-01-15T10:00:00Z'),
    rejectedAt: null,
    completedAt: new Date('2024-02-14T10:00:00Z'),
    defaultedAt: null,
    telcoReference: 'TEL-015',
  },
  {
    loanId: 'LOAN-016',
    userPhone: '08167890123',
    amount: 6000.0,
    status: LoanStatus.PENDING,
    network: Network.GLO,
    interestRate: 7.5,
    repaymentPeriod: 30,
    amountPaid: 0.0,
    approvedAt: null,
    rejectedAt: null,
    completedAt: null,
    defaultedAt: null,
    telcoReference: null,
  },
  {
    loanId: 'LOAN-017',
    userPhone: '08178901234',
    amount: 14000.0,
    status: LoanStatus.COMPLETED,
    network: Network.AIRTEL,
    interestRate: 5.5,
    repaymentPeriod: 30,
    amountPaid: 14770.0,
    approvedAt: new Date('2024-01-25T10:00:00Z'),
    rejectedAt: null,
    completedAt: new Date('2024-02-24T10:00:00Z'),
    defaultedAt: null,
    telcoReference: 'TEL-017',
  },
  {
    loanId: 'LOAN-018',
    userPhone: '08189012345',
    amount: 2000.0,
    status: LoanStatus.DEFAULTED,
    network: Network.MTN,
    interestRate: 8.0,
    repaymentPeriod: 30,
    amountPaid: 500.0,
    approvedAt: new Date('2024-01-10T10:00:00Z'),
    rejectedAt: null,
    completedAt: null,
    defaultedAt: new Date('2024-02-15T10:00:00Z'),
    telcoReference: 'TEL-018',
  },
  {
    loanId: 'LOAN-019',
    userPhone: '08190123456',
    amount: 35000.0,
    status: LoanStatus.COMPLETED,
    network: Network.MTN,
    interestRate: 5.0,
    repaymentPeriod: 90,
    amountPaid: 36750.0,
    approvedAt: new Date('2023-11-15T10:00:00Z'),
    rejectedAt: null,
    completedAt: new Date('2024-02-15T10:00:00Z'),
    defaultedAt: null,
    telcoReference: 'TEL-019',
  },
  {
    loanId: 'LOAN-020',
    userPhone: '08201234567',
    amount: 9000.0,
    status: LoanStatus.REPAYING,
    network: Network.AIRTEL,
    interestRate: 6.5,
    repaymentPeriod: 30,
    amountPaid: 4500.0,
    approvedAt: new Date('2024-02-08T10:00:00Z'),
    rejectedAt: null,
    completedAt: null,
    defaultedAt: null,
    telcoReference: 'TEL-020',
  },
  {
    loanId: 'LOAN-021',
    userPhone: '08012345678',
    amount: 11000.0,
    status: LoanStatus.COMPLETED,
    network: Network.MTN,
    interestRate: 5.5,
    repaymentPeriod: 30,
    amountPaid: 11605.0,
    approvedAt: new Date('2024-01-12T10:00:00Z'),
    rejectedAt: null,
    completedAt: new Date('2024-02-11T10:00:00Z'),
    defaultedAt: null,
    telcoReference: 'TEL-021',
  },
  {
    loanId: 'LOAN-022',
    userPhone: '08034567890',
    amount: 40000.0,
    status: LoanStatus.DISBURSED,
    network: Network.AIRTEL,
    interestRate: 6.0,
    repaymentPeriod: 60,
    amountPaid: 0.0,
    approvedAt: new Date('2024-02-05T10:00:00Z'),
    rejectedAt: null,
    completedAt: null,
    defaultedAt: null,
    telcoReference: 'TEL-022',
  },
  {
    loanId: 'LOAN-023',
    userPhone: '08067890123',
    amount: 16000.0,
    status: LoanStatus.COMPLETED,
    network: Network.MTN,
    interestRate: 6.0,
    repaymentPeriod: 30,
    amountPaid: 16960.0,
    approvedAt: new Date('2024-01-18T10:00:00Z'),
    rejectedAt: null,
    completedAt: new Date('2024-02-17T10:00:00Z'),
    defaultedAt: null,
    telcoReference: 'TEL-023',
  },
  {
    loanId: 'LOAN-024',
    userPhone: '08090123456',
    amount: 28000.0,
    status: LoanStatus.COMPLETED,
    network: Network.AIRTEL,
    interestRate: 5.5,
    repaymentPeriod: 60,
    amountPaid: 29540.0,
    approvedAt: new Date('2023-12-20T10:00:00Z'),
    rejectedAt: null,
    completedAt: new Date('2024-02-20T10:00:00Z'),
    defaultedAt: null,
    telcoReference: 'TEL-024',
  },
  {
    loanId: 'LOAN-025',
    userPhone: '08112345678',
    amount: 13000.0,
    status: LoanStatus.REPAYING,
    network: Network.MTN,
    interestRate: 6.0,
    repaymentPeriod: 30,
    amountPaid: 6500.0,
    approvedAt: new Date('2024-02-03T10:00:00Z'),
    rejectedAt: null,
    completedAt: null,
    defaultedAt: null,
    telcoReference: 'TEL-025',
  },
  {
    loanId: 'LOAN-026',
    userPhone: '08134567890',
    amount: 45000.0,
    status: LoanStatus.COMPLETED,
    network: Network.MTN,
    interestRate: 5.0,
    repaymentPeriod: 90,
    amountPaid: 47250.0,
    approvedAt: new Date('2023-11-01T10:00:00Z'),
    rejectedAt: null,
    completedAt: new Date('2024-01-30T10:00:00Z'),
    defaultedAt: null,
    telcoReference: 'TEL-026',
  },
  {
    loanId: 'LOAN-027',
    userPhone: '08156789012',
    amount: 19000.0,
    status: LoanStatus.COMPLETED,
    network: Network.AIRTEL,
    interestRate: 6.5,
    repaymentPeriod: 30,
    amountPaid: 20235.0,
    approvedAt: new Date('2024-01-22T10:00:00Z'),
    rejectedAt: null,
    completedAt: new Date('2024-02-21T10:00:00Z'),
    defaultedAt: null,
    telcoReference: 'TEL-027',
  },
  {
    loanId: 'LOAN-028',
    userPhone: '08178901234',
    amount: 7500.0,
    status: LoanStatus.APPROVED,
    network: Network.MTN,
    interestRate: 5.5,
    repaymentPeriod: 30,
    amountPaid: 0.0,
    approvedAt: new Date('2024-02-12T10:00:00Z'),
    rejectedAt: null,
    completedAt: null,
    defaultedAt: null,
    telcoReference: null,
  },
  {
    loanId: 'LOAN-029',
    userPhone: '08190123456',
    amount: 32000.0,
    status: LoanStatus.COMPLETED,
    network: Network.MTN,
    interestRate: 5.5,
    repaymentPeriod: 60,
    amountPaid: 33760.0,
    approvedAt: new Date('2023-12-15T10:00:00Z'),
    rejectedAt: null,
    completedAt: new Date('2024-02-15T10:00:00Z'),
    defaultedAt: null,
    telcoReference: 'TEL-029',
  },
  {
    loanId: 'LOAN-030',
    userPhone: '08201234567',
    amount: 17000.0,
    status: LoanStatus.REPAYING,
    network: Network.AIRTEL,
    interestRate: 6.0,
    repaymentPeriod: 30,
    amountPaid: 8500.0,
    approvedAt: new Date('2024-02-06T10:00:00Z'),
    rejectedAt: null,
    completedAt: null,
    defaultedAt: null,
    telcoReference: 'TEL-030',
  },
];

function calculateAmountDue(amount: number, interestRate: number): number {
  return amount * (1 + interestRate / 100);
}

function calculateOutstandingAmount(
  amountDue: number,
  amountPaid: number,
): number {
  return Math.max(0, amountDue - amountPaid);
}

function calculateDueDate(
  approvedAt: Date | null,
  repaymentPeriod: number,
): Date {
  if (approvedAt) {
    const dueDate = new Date(approvedAt);
    dueDate.setDate(dueDate.getDate() + repaymentPeriod);
    return dueDate;
  }
  // If not approved, set due date to 30 days from now
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + repaymentPeriod);
  return dueDate;
}

async function seedLoans(): Promise<void> {
  console.log('🌱 Seeding Loans...');
  const loanRepository = dataSource.getRepository(Loan);
  const userRepository = dataSource.getRepository(User);

  // Get all users to map phone numbers to UUIDs
  const users = await userRepository.find();
  const userMap = new Map<string, User>();
  users.forEach((user) => {
    userMap.set(user.phone, user);
  });

  if (users.length === 0) {
    console.log(
      '  ⚠️  No users found in database. Please seed users first.',
    );
    return;
  }

  let createdCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const loanData of loansToSeed) {
    const existingLoan = await loanRepository.findOne({
      where: { loanId: loanData.loanId },
    });

    if (existingLoan) {
      console.log(`  ⏭️  Loan already exists: ${loanData.loanId}`);
      skippedCount++;
      continue;
    }

    const user = userMap.get(loanData.userPhone);
    if (!user) {
      console.log(
        `  ❌ User not found for phone: ${loanData.userPhone} (Loan: ${loanData.loanId})`,
      );
      errorCount++;
      continue;
    }

    const amountDue = calculateAmountDue(
      loanData.amount,
      loanData.interestRate,
    );
    const outstandingAmount = calculateOutstandingAmount(
      amountDue,
      loanData.amountPaid,
    );
    const dueDate = calculateDueDate(
      loanData.approvedAt,
      loanData.repaymentPeriod,
    );

    console.log(`  Creating loan: ${loanData.loanId} for user ${user.userId}`);
    const loan = loanRepository.create({
      loanId: loanData.loanId,
      userId: user.id,
      userPhone: user.phone,
      userEmail: user.email,
      amount: loanData.amount,
      status: loanData.status,
      network: loanData.network,
      interestRate: loanData.interestRate,
      repaymentPeriod: loanData.repaymentPeriod,
      dueDate: dueDate,
      amountDue: amountDue,
      amountPaid: loanData.amountPaid,
      outstandingAmount: outstandingAmount,
      approvedAt: loanData.approvedAt,
      approvedBy: null,
      rejectedAt: loanData.rejectedAt,
      rejectedBy: null,
      rejectionReason: loanData.rejectedAt
        ? 'Insufficient credit score'
        : null,
      disbursedAt:
        loanData.status === LoanStatus.DISBURSED ||
        loanData.status === LoanStatus.REPAYING ||
        loanData.status === LoanStatus.COMPLETED
          ? loanData.approvedAt || new Date()
          : null,
      completedAt: loanData.completedAt,
      defaultedAt: loanData.defaultedAt,
      telcoReference: loanData.telcoReference,
      metadata: null,
    });

    await loanRepository.save(loan);
    console.log(
      `  ✅ Created loan: ${loanData.loanId} - Amount: ${loanData.amount}, Status: ${loanData.status}`,
    );
    createdCount++;
  }

  console.log(
    `✅ Completed seeding Loans: ${createdCount} created, ${skippedCount} skipped, ${errorCount} errors\n`,
  );
}

async function runSeed(): Promise<void> {
  console.log('==========================================');
  console.log('Loan Seeding Script');
  console.log('==========================================\n');

  try {
    // Initialize DataSource
    if (!dataSource.isInitialized) {
      console.log('📡 Connecting to database...');
      await dataSource.initialize();
      console.log('✅ Database connected\n');
    }

    // Seed loans
    await seedLoans();

    console.log('==========================================');
    console.log('✅ Seeding completed successfully!');
    console.log('==========================================');
    console.log(`\n📝 Total loans in seed data: ${loansToSeed.length}`);
  } catch (error) {
    console.error('❌ Error during seeding:', error);
    throw error;
  } finally {
    // Close DataSource connection
    if (dataSource.isInitialized) {
      await dataSource.destroy();
      console.log('📡 Database connection closed');
    }
  }
}

// Run the seed if this file is executed directly
if (require.main === module) {
  runSeed()
    .then(() => {
      console.log('✅ Seed script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Seed script failed:', error);
      process.exit(1);
    });
}

export { runSeed };

