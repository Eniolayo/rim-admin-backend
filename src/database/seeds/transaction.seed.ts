import dataSource from '../data-source';
import {
  Transaction,
  TransactionType,
  TransactionStatus,
  PaymentMethod,
} from '../../entities/transaction.entity';
import { User } from '../../entities/user.entity';

interface TransactionSeedData {
  transactionId: string;
  userPhone: string;
  type: TransactionType;
  amount: number;
  status: TransactionStatus;
  paymentMethod: PaymentMethod | null;
  description: string | null;
  reference: string | null;
  provider: string | null;
  network: string | null;
  reconciledAt: Date | null;
  notes: string | null;
}

const transactionsToSeed: TransactionSeedData[] = [
  {
    transactionId: 'TXN-001',
    userPhone: '08012345678',
    type: TransactionType.REPAYMENT,
    amount: 5250.0,
    status: TransactionStatus.COMPLETED,
    paymentMethod: PaymentMethod.BANK_TRANSFER,
    description: 'Loan repayment for LOAN-001',
    reference: 'REF-001',
    provider: 'Bank',
    network: null,
    reconciledAt: new Date('2024-02-14T10:00:00Z'),
    notes: 'Full repayment completed',
  },
  {
    transactionId: 'TXN-002',
    userPhone: '08023456789',
    type: TransactionType.REPAYMENT,
    amount: 5000.0,
    status: TransactionStatus.COMPLETED,
    paymentMethod: PaymentMethod.WALLET,
    description: 'Partial loan repayment',
    reference: 'REF-002',
    provider: 'Wallet',
    network: null,
    reconciledAt: new Date('2024-02-10T10:00:00Z'),
    notes: null,
  },
  {
    transactionId: 'TXN-003',
    userPhone: '08034567890',
    type: TransactionType.AIRTIME,
    amount: 1000.0,
    status: TransactionStatus.COMPLETED,
    paymentMethod: PaymentMethod.WALLET,
    description: 'Airtime purchase',
    reference: 'REF-003',
    provider: 'MTN',
    network: 'MTN',
    reconciledAt: new Date('2024-02-15T10:00:00Z'),
    notes: null,
  },
  {
    transactionId: 'TXN-004',
    userPhone: '08045678901',
    type: TransactionType.AIRTIME,
    amount: 500.0,
    status: TransactionStatus.FAILED,
    paymentMethod: PaymentMethod.CARD,
    description: 'Airtime purchase failed',
    reference: 'REF-004',
    provider: 'Glo',
    network: 'Glo',
    reconciledAt: null,
    notes: 'Insufficient funds',
  },
  {
    transactionId: 'TXN-005',
    userPhone: '08056789012',
    type: TransactionType.AIRTIME,
    amount: 2000.0,
    status: TransactionStatus.PENDING,
    paymentMethod: PaymentMethod.WALLET,
    description: 'Airtime purchase pending',
    reference: 'REF-005',
    provider: 'MTN',
    network: 'MTN',
    reconciledAt: null,
    notes: null,
  },
  {
    transactionId: 'TXN-006',
    userPhone: '08067890123',
    type: TransactionType.REPAYMENT,
    amount: 26625.0,
    status: TransactionStatus.COMPLETED,
    paymentMethod: PaymentMethod.BANK_TRANSFER,
    description: 'Loan repayment for LOAN-006',
    reference: 'REF-006',
    provider: 'Bank',
    network: null,
    reconciledAt: new Date('2024-03-10T10:00:00Z'),
    notes: 'Full repayment completed',
  },
  {
    transactionId: 'TXN-007',
    userPhone: '08078901234',
    type: TransactionType.REPAYMENT,
    amount: 2000.0,
    status: TransactionStatus.COMPLETED,
    paymentMethod: PaymentMethod.CASH,
    description: 'Partial loan repayment',
    reference: 'REF-007',
    provider: 'Cash',
    network: null,
    reconciledAt: new Date('2024-01-20T10:00:00Z'),
    notes: null,
  },
  {
    transactionId: 'TXN-008',
    userPhone: '08089012345',
    type: TransactionType.REPAYMENT,
    amount: 6000.0,
    status: TransactionStatus.COMPLETED,
    paymentMethod: PaymentMethod.WALLET,
    description: 'Loan repayment for LOAN-008',
    reference: 'REF-008',
    provider: 'Wallet',
    network: null,
    reconciledAt: new Date('2024-02-20T10:00:00Z'),
    notes: null,
  },
  {
    transactionId: 'TXN-009',
    userPhone: '08090123456',
    type: TransactionType.AIRTIME,
    amount: 1500.0,
    status: TransactionStatus.COMPLETED,
    paymentMethod: PaymentMethod.CARD,
    description: 'Airtime purchase',
    reference: 'REF-009',
    provider: 'Airtel',
    network: 'Airtel',
    reconciledAt: new Date('2024-02-18T10:00:00Z'),
    notes: null,
  },
  {
    transactionId: 'TXN-010',
    userPhone: '08101234567',
    type: TransactionType.AIRTIME,
    amount: 3000.0,
    status: TransactionStatus.COMPLETED,
    paymentMethod: PaymentMethod.WALLET,
    description: 'Airtime purchase',
    reference: 'REF-010',
    provider: 'MTN',
    network: 'MTN',
    reconciledAt: new Date('2024-02-12T10:00:00Z'),
    notes: null,
  },
  {
    transactionId: 'TXN-011',
    userPhone: '08112345678',
    type: TransactionType.REPAYMENT,
    amount: 19170.0,
    status: TransactionStatus.COMPLETED,
    paymentMethod: PaymentMethod.BANK_TRANSFER,
    description: 'Loan repayment for LOAN-011',
    reference: 'REF-011',
    provider: 'Bank',
    network: null,
    reconciledAt: new Date('2024-02-19T10:00:00Z'),
    notes: 'Full repayment completed',
  },
  {
    transactionId: 'TXN-012',
    userPhone: '08123456789',
    type: TransactionType.AIRTIME,
    amount: 800.0,
    status: TransactionStatus.REFUNDED,
    paymentMethod: PaymentMethod.CARD,
    description: 'Airtime purchase refunded',
    reference: 'REF-012',
    provider: 'Glo',
    network: 'Glo',
    reconciledAt: new Date('2024-02-16T10:00:00Z'),
    notes: 'Service unavailable, refund processed',
  },
  {
    transactionId: 'TXN-013',
    userPhone: '08134567890',
    type: TransactionType.REPAYMENT,
    amount: 52750.0,
    status: TransactionStatus.COMPLETED,
    paymentMethod: PaymentMethod.BANK_TRANSFER,
    description: 'Loan repayment for LOAN-013',
    reference: 'REF-013',
    provider: 'Bank',
    network: null,
    reconciledAt: new Date('2024-03-01T10:00:00Z'),
    notes: 'Full repayment completed',
  },
  {
    transactionId: 'TXN-014',
    userPhone: '08145678901',
    type: TransactionType.REPAYMENT,
    amount: 3500.0,
    status: TransactionStatus.COMPLETED,
    paymentMethod: PaymentMethod.WALLET,
    description: 'Loan repayment for LOAN-014',
    reference: 'REF-014',
    provider: 'Wallet',
    network: null,
    reconciledAt: new Date('2024-02-15T10:00:00Z'),
    notes: null,
  },
  {
    transactionId: 'TXN-015',
    userPhone: '08156789012',
    type: TransactionType.AIRTIME,
    amount: 2500.0,
    status: TransactionStatus.COMPLETED,
    paymentMethod: PaymentMethod.WALLET,
    description: 'Airtime purchase',
    reference: 'REF-015',
    provider: 'MTN',
    network: 'MTN',
    reconciledAt: new Date('2024-02-20T10:00:00Z'),
    notes: null,
  },
  {
    transactionId: 'TXN-016',
    userPhone: '08167890123',
    type: TransactionType.AIRTIME,
    amount: 1000.0,
    status: TransactionStatus.PENDING,
    paymentMethod: PaymentMethod.CARD,
    description: 'Airtime purchase pending',
    reference: 'REF-016',
    provider: 'Glo',
    network: 'Glo',
    reconciledAt: null,
    notes: null,
  },
  {
    transactionId: 'TXN-017',
    userPhone: '08178901234',
    type: TransactionType.REPAYMENT,
    amount: 14770.0,
    status: TransactionStatus.COMPLETED,
    paymentMethod: PaymentMethod.BANK_TRANSFER,
    description: 'Loan repayment for LOAN-017',
    reference: 'REF-017',
    provider: 'Bank',
    network: null,
    reconciledAt: new Date('2024-02-24T10:00:00Z'),
    notes: 'Full repayment completed',
  },
  {
    transactionId: 'TXN-018',
    userPhone: '08189012345',
    type: TransactionType.REPAYMENT,
    amount: 500.0,
    status: TransactionStatus.COMPLETED,
    paymentMethod: PaymentMethod.CASH,
    description: 'Partial loan repayment',
    reference: 'REF-018',
    provider: 'Cash',
    network: null,
    reconciledAt: new Date('2024-01-25T10:00:00Z'),
    notes: null,
  },
  {
    transactionId: 'TXN-019',
    userPhone: '08190123456',
    type: TransactionType.REPAYMENT,
    amount: 36750.0,
    status: TransactionStatus.COMPLETED,
    paymentMethod: PaymentMethod.BANK_TRANSFER,
    description: 'Loan repayment for LOAN-019',
    reference: 'REF-019',
    provider: 'Bank',
    network: null,
    reconciledAt: new Date('2024-02-15T10:00:00Z'),
    notes: 'Full repayment completed',
  },
  {
    transactionId: 'TXN-020',
    userPhone: '08201234567',
    type: TransactionType.REPAYMENT,
    amount: 4500.0,
    status: TransactionStatus.COMPLETED,
    paymentMethod: PaymentMethod.WALLET,
    description: 'Loan repayment for LOAN-020',
    reference: 'REF-020',
    provider: 'Wallet',
    network: null,
    reconciledAt: new Date('2024-02-20T10:00:00Z'),
    notes: null,
  },
  {
    transactionId: 'TXN-021',
    userPhone: '08012345678',
    type: TransactionType.AIRTIME,
    amount: 5000.0,
    status: TransactionStatus.COMPLETED,
    paymentMethod: PaymentMethod.WALLET,
    description: 'Airtime purchase',
    reference: 'REF-021',
    provider: 'MTN',
    network: 'MTN',
    reconciledAt: new Date('2024-02-18T10:00:00Z'),
    notes: null,
  },
  {
    transactionId: 'TXN-022',
    userPhone: '08023456789',
    type: TransactionType.AIRTIME,
    amount: 2000.0,
    status: TransactionStatus.COMPLETED,
    paymentMethod: PaymentMethod.CARD,
    description: 'Airtime purchase',
    reference: 'REF-022',
    provider: 'Airtel',
    network: 'Airtel',
    reconciledAt: new Date('2024-02-14T10:00:00Z'),
    notes: null,
  },
  {
    transactionId: 'TXN-023',
    userPhone: '08034567890',
    type: TransactionType.REPAYMENT,
    amount: 11605.0,
    status: TransactionStatus.COMPLETED,
    paymentMethod: PaymentMethod.BANK_TRANSFER,
    description: 'Loan repayment for LOAN-021',
    reference: 'REF-023',
    provider: 'Bank',
    network: null,
    reconciledAt: new Date('2024-02-11T10:00:00Z'),
    notes: 'Full repayment completed',
  },
  {
    transactionId: 'TXN-024',
    userPhone: '08067890123',
    type: TransactionType.AIRTIME,
    amount: 3000.0,
    status: TransactionStatus.COMPLETED,
    paymentMethod: PaymentMethod.WALLET,
    description: 'Airtime purchase',
    reference: 'REF-024',
    provider: 'MTN',
    network: 'MTN',
    reconciledAt: new Date('2024-02-16T10:00:00Z'),
    notes: null,
  },
  {
    transactionId: 'TXN-025',
    userPhone: '08090123456',
    type: TransactionType.REPAYMENT,
    amount: 29540.0,
    status: TransactionStatus.COMPLETED,
    paymentMethod: PaymentMethod.BANK_TRANSFER,
    description: 'Loan repayment for LOAN-024',
    reference: 'REF-025',
    provider: 'Bank',
    network: null,
    reconciledAt: new Date('2024-02-20T10:00:00Z'),
    notes: 'Full repayment completed',
  },
  {
    transactionId: 'TXN-026',
    userPhone: '08112345678',
    type: TransactionType.REPAYMENT,
    amount: 6500.0,
    status: TransactionStatus.COMPLETED,
    paymentMethod: PaymentMethod.WALLET,
    description: 'Loan repayment for LOAN-025',
    reference: 'REF-026',
    provider: 'Wallet',
    network: null,
    reconciledAt: new Date('2024-02-18T10:00:00Z'),
    notes: null,
  },
  {
    transactionId: 'TXN-027',
    userPhone: '08134567890',
    type: TransactionType.REPAYMENT,
    amount: 47250.0,
    status: TransactionStatus.COMPLETED,
    paymentMethod: PaymentMethod.BANK_TRANSFER,
    description: 'Loan repayment for LOAN-026',
    reference: 'REF-027',
    provider: 'Bank',
    network: null,
    reconciledAt: new Date('2024-01-30T10:00:00Z'),
    notes: 'Full repayment completed',
  },
  {
    transactionId: 'TXN-028',
    userPhone: '08156789012',
    type: TransactionType.AIRTIME,
    amount: 4000.0,
    status: TransactionStatus.COMPLETED,
    paymentMethod: PaymentMethod.CARD,
    description: 'Airtime purchase',
    reference: 'REF-028',
    provider: 'Airtel',
    network: 'Airtel',
    reconciledAt: new Date('2024-02-22T10:00:00Z'),
    notes: null,
  },
  {
    transactionId: 'TXN-029',
    userPhone: '08156789012',
    type: TransactionType.REPAYMENT,
    amount: 20235.0,
    status: TransactionStatus.COMPLETED,
    paymentMethod: PaymentMethod.BANK_TRANSFER,
    description: 'Loan repayment for LOAN-027',
    reference: 'REF-029',
    provider: 'Bank',
    network: null,
    reconciledAt: new Date('2024-02-21T10:00:00Z'),
    notes: 'Full repayment completed',
  },
  {
    transactionId: 'TXN-030',
    userPhone: '08178901234',
    type: TransactionType.AIRTIME,
    amount: 1500.0,
    status: TransactionStatus.FAILED,
    paymentMethod: PaymentMethod.CARD,
    description: 'Airtime purchase failed',
    reference: 'REF-030',
    provider: 'MTN',
    network: 'MTN',
    reconciledAt: null,
    notes: 'Card declined',
  },
  {
    transactionId: 'TXN-031',
    userPhone: '08190123456',
    type: TransactionType.REPAYMENT,
    amount: 33760.0,
    status: TransactionStatus.COMPLETED,
    paymentMethod: PaymentMethod.BANK_TRANSFER,
    description: 'Loan repayment for LOAN-029',
    reference: 'REF-031',
    provider: 'Bank',
    network: null,
    reconciledAt: new Date('2024-02-15T10:00:00Z'),
    notes: 'Full repayment completed',
  },
  {
    transactionId: 'TXN-032',
    userPhone: '08201234567',
    type: TransactionType.REPAYMENT,
    amount: 8500.0,
    status: TransactionStatus.COMPLETED,
    paymentMethod: PaymentMethod.WALLET,
    description: 'Loan repayment for LOAN-030',
    reference: 'REF-032',
    provider: 'Wallet',
    network: null,
    reconciledAt: new Date('2024-02-20T10:00:00Z'),
    notes: null,
  },
  {
    transactionId: 'TXN-033',
    userPhone: '08012345678',
    type: TransactionType.AIRTIME,
    amount: 6000.0,
    status: TransactionStatus.COMPLETED,
    paymentMethod: PaymentMethod.WALLET,
    description: 'Airtime purchase',
    reference: 'REF-033',
    provider: 'MTN',
    network: 'MTN',
    reconciledAt: new Date('2024-02-19T10:00:00Z'),
    notes: null,
  },
  {
    transactionId: 'TXN-034',
    userPhone: '08034567890',
    type: TransactionType.AIRTIME,
    amount: 2500.0,
    status: TransactionStatus.PENDING,
    paymentMethod: PaymentMethod.CARD,
    description: 'Airtime purchase pending',
    reference: 'REF-034',
    provider: 'Airtel',
    network: 'Airtel',
    reconciledAt: null,
    notes: null,
  },
  {
    transactionId: 'TXN-035',
    userPhone: '08067890123',
    type: TransactionType.REPAYMENT,
    amount: 16960.0,
    status: TransactionStatus.COMPLETED,
    paymentMethod: PaymentMethod.BANK_TRANSFER,
    description: 'Loan repayment for LOAN-023',
    reference: 'REF-035',
    provider: 'Bank',
    network: null,
    reconciledAt: new Date('2024-02-17T10:00:00Z'),
    notes: 'Full repayment completed',
  },
  {
    transactionId: 'TXN-036',
    userPhone: '08090123456',
    type: TransactionType.AIRTIME,
    amount: 3500.0,
    status: TransactionStatus.COMPLETED,
    paymentMethod: PaymentMethod.WALLET,
    description: 'Airtime purchase',
    reference: 'REF-036',
    provider: 'MTN',
    network: 'MTN',
    reconciledAt: new Date('2024-02-21T10:00:00Z'),
    notes: null,
  },
  {
    transactionId: 'TXN-037',
    userPhone: '08112345678',
    type: TransactionType.AIRTIME,
    amount: 1800.0,
    status: TransactionStatus.COMPLETED,
    paymentMethod: PaymentMethod.CARD,
    description: 'Airtime purchase',
    reference: 'REF-037',
    provider: 'Airtel',
    network: 'Airtel',
    reconciledAt: new Date('2024-02-19T10:00:00Z'),
    notes: null,
  },
  {
    transactionId: 'TXN-038',
    userPhone: '08134567890',
    type: TransactionType.REPAYMENT,
    amount: 8500.0,
    status: TransactionStatus.COMPLETED,
    paymentMethod: PaymentMethod.WALLET,
    description: 'Partial loan repayment',
    reference: 'REF-038',
    provider: 'Wallet',
    network: null,
    reconciledAt: new Date('2024-02-25T10:00:00Z'),
    notes: null,
  },
  {
    transactionId: 'TXN-039',
    userPhone: '08156789012',
    type: TransactionType.AIRTIME,
    amount: 2200.0,
    status: TransactionStatus.COMPLETED,
    paymentMethod: PaymentMethod.WALLET,
    description: 'Airtime purchase',
    reference: 'REF-039',
    provider: 'MTN',
    network: 'MTN',
    reconciledAt: new Date('2024-02-23T10:00:00Z'),
    notes: null,
  },
  {
    transactionId: 'TXN-040',
    userPhone: '08201234567',
    type: TransactionType.AIRTIME,
    amount: 1200.0,
    status: TransactionStatus.COMPLETED,
    paymentMethod: PaymentMethod.CARD,
    description: 'Airtime purchase',
    reference: 'REF-040',
    provider: 'Airtel',
    network: 'Airtel',
    reconciledAt: new Date('2024-02-21T10:00:00Z'),
    notes: null,
  },
];

async function seedTransactions(): Promise<void> {
  console.log('🌱 Seeding Transactions...');
  const transactionRepository = dataSource.getRepository(Transaction);
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

  for (const transactionData of transactionsToSeed) {
    const existingTransaction = await transactionRepository.findOne({
      where: { transactionId: transactionData.transactionId },
    });

    if (existingTransaction) {
      console.log(
        `  ⏭️  Transaction already exists: ${transactionData.transactionId}`,
      );
      skippedCount++;
      continue;
    }

    const user = userMap.get(transactionData.userPhone);
    if (!user) {
      console.log(
        `  ❌ User not found for phone: ${transactionData.userPhone} (Transaction: ${transactionData.transactionId})`,
      );
      errorCount++;
      continue;
    }

    console.log(
      `  Creating transaction: ${transactionData.transactionId} for user ${user.userId}`,
    );
    const transaction = transactionRepository.create({
      transactionId: transactionData.transactionId,
      userId: user.id,
      userPhone: user.phone,
      userEmail: user.email,
      type: transactionData.type,
      amount: transactionData.amount,
      status: transactionData.status,
      paymentMethod: transactionData.paymentMethod,
      description: transactionData.description,
      reference: transactionData.reference,
      provider: transactionData.provider,
      network: transactionData.network,
      reconciledAt: transactionData.reconciledAt,
      reconciledBy: transactionData.reconciledAt ? null : null, // Can be set to admin UUID if needed
      notes: transactionData.notes,
      metadata: null,
    });

    await transactionRepository.save(transaction);
    console.log(
      `  ✅ Created transaction: ${transactionData.transactionId} - Amount: ${transactionData.amount}, Type: ${transactionData.type}, Status: ${transactionData.status}`,
    );
    createdCount++;
  }

  console.log(
    `✅ Completed seeding Transactions: ${createdCount} created, ${skippedCount} skipped, ${errorCount} errors\n`,
  );
}

async function runSeed(): Promise<void> {
  console.log('==========================================');
  console.log('Transaction Seeding Script');
  console.log('==========================================\n');

  try {
    // Initialize DataSource
    if (!dataSource.isInitialized) {
      console.log('📡 Connecting to database...');
      await dataSource.initialize();
      console.log('✅ Database connected\n');
    }

    // Seed transactions
    await seedTransactions();

    console.log('==========================================');
    console.log('✅ Seeding completed successfully!');
    console.log('==========================================');
    console.log(`\n📝 Total transactions in seed data: ${transactionsToSeed.length}`);
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

