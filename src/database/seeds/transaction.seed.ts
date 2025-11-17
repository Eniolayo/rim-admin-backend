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
  createdAt?: Date;
}

const transactionsToSeed: TransactionSeedData[] = [
  {
    transactionId: 'TXN-0101',
    userPhone: '08111160155',
    type: TransactionType.REPAYMENT,
    amount: 500.0,
    status: TransactionStatus.PENDING,
    paymentMethod: PaymentMethod.WALLET,
    description: 'Loan repayment pending reconciliation',
    reference: 'REF-001',
    provider: 'MTN',
    network: 'MTN',
    reconciledAt: null,
    notes: null,
  },
  {
    transactionId: 'TXN-0102',
    userPhone: '08111160133',
    type: TransactionType.REPAYMENT,
    amount: 250.0,
    status: TransactionStatus.PENDING,
    paymentMethod: PaymentMethod.WALLET,
    description: 'Loan repayment pending reconciliation',
    reference: 'REF-002',
    provider: 'MTN',
    network: 'MTN',
    reconciledAt: null,
    notes: null,
  },
  {
    transactionId: 'TXN-0103',
    userPhone: '08111160133',
    type: TransactionType.REPAYMENT,
    amount: 250.0,
    status: TransactionStatus.PENDING,
    paymentMethod: PaymentMethod.WALLET,
    description: 'Loan repayment pending reconciliation',
    reference: 'REF-003',
    provider: 'MTN',
    network: 'MTN',
    reconciledAt: null,
    notes: null,
  },
  {
    transactionId: 'TXN-0201',
    userPhone: '08111160155',
    type: TransactionType.REPAYMENT,
    amount: 500.0,
    status: TransactionStatus.PENDING,
    paymentMethod: PaymentMethod.WALLET,
    description: 'Loan repayment pending reconciliation',
    reference: 'REF-004',
    provider: 'MTN',
    network: 'MTN',
    reconciledAt: null,
    notes: null,
    createdAt: new Date('2024-03-15T14:30:00Z'),
  },
  {
    transactionId: 'TXN-0202',
    userPhone: '08111160133',
    type: TransactionType.REPAYMENT,
    amount: 250.0,
    status: TransactionStatus.PENDING,
    paymentMethod: PaymentMethod.WALLET,
    description: 'Loan repayment pending reconciliation',
    reference: 'REF-005',
    provider: 'MTN',
    network: 'MTN',
    reconciledAt: null,
    notes: null,
    createdAt: new Date('2024-03-15T14:35:00Z'),
  },
  {
    transactionId: 'TXN-0203',
    userPhone: '08111160133',
    type: TransactionType.REPAYMENT,
    amount: 250.0,
    status: TransactionStatus.PENDING,
    paymentMethod: PaymentMethod.WALLET,
    description: 'Loan repayment pending reconciliation',
    reference: 'REF-006',
    provider: 'MTN',
    network: 'MTN',
    reconciledAt: null,
    notes: null,
    createdAt: new Date('2024-03-15T14:40:00Z'),
  },
  // {
  //   transactionId: 'TXN-0301',
  //   userPhone: '08111160155',
  //   type: TransactionType.REPAYMENT,
  //   amount: 500.0,
  //   status: TransactionStatus.PENDING,
  //   paymentMethod: PaymentMethod.WALLET,
  //   description: 'Loan repayment pending reconciliation',
  //   reference: 'REF-007',
  //   provider: 'MTN',
  //   network: 'MTN',
  //   reconciledAt: null,
  //   notes: null,
  //   createdAt: new Date('2024-03-20T09:15:00Z'),
  // },
  // {
  //   transactionId: 'TXN-0302',
  //   userPhone: '08111160133',
  //   type: TransactionType.REPAYMENT,
  //   amount: 250.0,
  //   status: TransactionStatus.PENDING,
  //   paymentMethod: PaymentMethod.WALLET,
  //   description: 'Loan repayment pending reconciliation',
  //   reference: 'REF-008',
  //   provider: 'MTN',
  //   network: 'MTN',
  //   reconciledAt: null,
  //   notes: null,
  //   createdAt: new Date('2024-03-20T09:20:00Z'),
  // },
  // {
  //   transactionId: 'TXN-0303',
  //   userPhone: '08111160133',
  //   type: TransactionType.REPAYMENT,
  //   amount: 250.0,
  //   status: TransactionStatus.PENDING,
  //   paymentMethod: PaymentMethod.WALLET,
  //   description: 'Loan repayment pending reconciliation',
  //   reference: 'REF-009',
  //   provider: 'MTN',
  //   network: 'MTN',
  //   reconciledAt: null,
  //   notes: null,
  //   createdAt: new Date('2024-03-20T09:25:00Z'),
  // },
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
    const transactionDataToCreate: any = {
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
    };

    // Set createdAt if provided
    if (transactionData.createdAt) {
      transactionDataToCreate.createdAt = transactionData.createdAt;
    }

    const transaction = transactionRepository.create(transactionDataToCreate);

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

