import dataSource from '../data-source';
import { User, UserStatus, RepaymentStatus } from '../../entities/user.entity';

interface UserSeedData {
  userId: string;
  phone: string;
  email: string | null;
  creditScore: number;
  repaymentStatus: RepaymentStatus;
  totalRepaid: number;
  status: UserStatus;
  creditLimit: number;
  autoLimitEnabled: boolean;
  totalLoans: number | null;
}

const usersToSeed: UserSeedData[] = [
  {
    userId: 'USR-001',
    phone: '08012345678',
    email: 'user1@example.com',
    creditScore: 750,
    repaymentStatus: RepaymentStatus.COMPLETED,
    totalRepaid: 50000.0,
    status: UserStatus.ACTIVE,
    creditLimit: 100000.0,
    autoLimitEnabled: true,
    totalLoans: 5,
  },
  {
    userId: 'USR-002',
    phone: '08023456789',
    email: 'user2@example.com',
    creditScore: 680,
    repaymentStatus: RepaymentStatus.PARTIAL,
    totalRepaid: 25000.0,
    status: UserStatus.ACTIVE,
    creditLimit: 75000.0,
    autoLimitEnabled: false,
    totalLoans: 3,
  },
  {
    userId: 'USR-003',
    phone: '08034567890',
    email: 'user3@example.com',
    creditScore: 820,
    repaymentStatus: RepaymentStatus.COMPLETED,
    totalRepaid: 150000.0,
    status: UserStatus.ACTIVE,
    creditLimit: 200000.0,
    autoLimitEnabled: true,
    totalLoans: 12,
  },
  {
    userId: 'USR-004',
    phone: '08045678901',
    email: 'user4@example.com',
    creditScore: 450,
    repaymentStatus: RepaymentStatus.OVERDUE,
    totalRepaid: 10000.0,
    status: UserStatus.ACTIVE,
    creditLimit: 30000.0,
    autoLimitEnabled: false,
    totalLoans: 2,
  },
  {
    userId: 'USR-005',
    phone: '08056789012',
    email: 'user5@example.com',
    creditScore: 590,
    repaymentStatus: RepaymentStatus.PENDING,
    totalRepaid: 0.0,
    status: UserStatus.ACTIVE,
    creditLimit: 50000.0,
    autoLimitEnabled: true,
    totalLoans: 1,
  },
  {
    userId: 'USR-006',
    phone: '08067890123',
    email: 'user6@example.com',
    creditScore: 720,
    repaymentStatus: RepaymentStatus.COMPLETED,
    totalRepaid: 80000.0,
    status: UserStatus.ACTIVE,
    creditLimit: 120000.0,
    autoLimitEnabled: true,
    totalLoans: 8,
  },
  {
    userId: 'USR-007',
    phone: '08078901234',
    email: 'user7@example.com',
    creditScore: 380,
    repaymentStatus: RepaymentStatus.OVERDUE,
    totalRepaid: 5000.0,
    status: UserStatus.SUSPENDED,
    creditLimit: 20000.0,
    autoLimitEnabled: false,
    totalLoans: 1,
  },
  {
    userId: 'USR-008',
    phone: '08089012345',
    email: 'user8@example.com',
    creditScore: 650,
    repaymentStatus: RepaymentStatus.PARTIAL,
    totalRepaid: 35000.0,
    status: UserStatus.ACTIVE,
    creditLimit: 80000.0,
    autoLimitEnabled: false,
    totalLoans: 4,
  },
  {
    userId: 'USR-009',
    phone: '08090123456',
    email: 'user9@example.com',
    creditScore: 780,
    repaymentStatus: RepaymentStatus.COMPLETED,
    totalRepaid: 95000.0,
    status: UserStatus.ACTIVE,
    creditLimit: 150000.0,
    autoLimitEnabled: true,
    totalLoans: 10,
  },
  {
    userId: 'USR-010',
    phone: '08101234567',
    email: 'user10@example.com',
    creditScore: 520,
    repaymentStatus: RepaymentStatus.PENDING,
    totalRepaid: 15000.0,
    status: UserStatus.ACTIVE,
    creditLimit: 40000.0,
    autoLimitEnabled: false,
    totalLoans: 2,
  },
  {
    userId: 'USR-011',
    phone: '08112345678',
    email: 'user11@example.com',
    creditScore: 690,
    repaymentStatus: RepaymentStatus.COMPLETED,
    totalRepaid: 60000.0,
    status: UserStatus.ACTIVE,
    creditLimit: 90000.0,
    autoLimitEnabled: true,
    totalLoans: 6,
  },
  {
    userId: 'USR-012',
    phone: '08123456789',
    email: null,
    creditScore: 420,
    repaymentStatus: RepaymentStatus.OVERDUE,
    totalRepaid: 8000.0,
    status: UserStatus.INACTIVE,
    creditLimit: 25000.0,
    autoLimitEnabled: false,
    totalLoans: 1,
  },
  {
    userId: 'USR-013',
    phone: '08134567890',
    email: 'user13@example.com',
    creditScore: 850,
    repaymentStatus: RepaymentStatus.COMPLETED,
    totalRepaid: 200000.0,
    status: UserStatus.ACTIVE,
    creditLimit: 250000.0,
    autoLimitEnabled: true,
    totalLoans: 15,
  },
  {
    userId: 'USR-014',
    phone: '08145678901',
    email: 'user14@example.com',
    creditScore: 580,
    repaymentStatus: RepaymentStatus.PARTIAL,
    totalRepaid: 20000.0,
    status: UserStatus.ACTIVE,
    creditLimit: 55000.0,
    autoLimitEnabled: false,
    totalLoans: 3,
  },
  {
    userId: 'USR-015',
    phone: '08156789012',
    email: 'user15@example.com',
    creditScore: 710,
    repaymentStatus: RepaymentStatus.COMPLETED,
    totalRepaid: 70000.0,
    status: UserStatus.ACTIVE,
    creditLimit: 110000.0,
    autoLimitEnabled: true,
    totalLoans: 7,
  },
  {
    userId: 'USR-016',
    phone: '08167890123',
    email: 'user16@example.com',
    creditScore: 480,
    repaymentStatus: RepaymentStatus.PENDING,
    totalRepaid: 12000.0,
    status: UserStatus.ACTIVE,
    creditLimit: 35000.0,
    autoLimitEnabled: false,
    totalLoans: 2,
  },
  {
    userId: 'USR-017',
    phone: '08178901234',
    email: 'user17@example.com',
    creditScore: 640,
    repaymentStatus: RepaymentStatus.COMPLETED,
    totalRepaid: 45000.0,
    status: UserStatus.ACTIVE,
    creditLimit: 85000.0,
    autoLimitEnabled: true,
    totalLoans: 5,
  },
  {
    userId: 'USR-018',
    phone: '08189012345',
    email: null,
    creditScore: 350,
    repaymentStatus: RepaymentStatus.OVERDUE,
    totalRepaid: 3000.0,
    status: UserStatus.SUSPENDED,
    creditLimit: 15000.0,
    autoLimitEnabled: false,
    totalLoans: 1,
  },
  {
    userId: 'USR-019',
    phone: '08190123456',
    email: 'user19@example.com',
    creditScore: 760,
    repaymentStatus: RepaymentStatus.COMPLETED,
    totalRepaid: 105000.0,
    status: UserStatus.ACTIVE,
    creditLimit: 160000.0,
    autoLimitEnabled: true,
    totalLoans: 11,
  },
  {
    userId: 'USR-020',
    phone: '08201234567',
    email: 'user20@example.com',
    creditScore: 600,
    repaymentStatus: RepaymentStatus.PARTIAL,
    totalRepaid: 28000.0,
    status: UserStatus.ACTIVE,
    creditLimit: 65000.0,
    autoLimitEnabled: false,
    totalLoans: 4,
  },
];

async function seedUsers(): Promise<void> {
  console.log('🌱 Seeding Users...');
  const userRepository = dataSource.getRepository(User);

  let createdCount = 0;
  let skippedCount = 0;

  for (const userData of usersToSeed) {
    const existingUser = await userRepository.findOne({
      where: { userId: userData.userId },
    });

    if (existingUser) {
      console.log(`  ⏭️  User already exists: ${userData.userId} (${userData.phone})`);
      skippedCount++;
      continue;
    }

    console.log(`  Creating user: ${userData.userId} (${userData.phone})`);
    const user = userRepository.create({
      userId: userData.userId,
      phone: userData.phone,
      email: userData.email,
      creditScore: userData.creditScore,
      repaymentStatus: userData.repaymentStatus,
      totalRepaid: userData.totalRepaid,
      status: userData.status,
      creditLimit: userData.creditLimit,
      autoLimitEnabled: userData.autoLimitEnabled,
      totalLoans: userData.totalLoans,
    });

    await userRepository.save(user);
    console.log(
      `  ✅ Created user: ${userData.userId} (${userData.phone}) - Credit Score: ${userData.creditScore}`,
    );
    createdCount++;
  }

  console.log(
    `✅ Completed seeding Users: ${createdCount} created, ${skippedCount} skipped\n`,
  );
}

async function runSeed(): Promise<void> {
  console.log('==========================================');
  console.log('User Seeding Script');
  console.log('==========================================\n');

  try {
    // Initialize DataSource
    if (!dataSource.isInitialized) {
      console.log('📡 Connecting to database...');
      await dataSource.initialize();
      console.log('✅ Database connected\n');
    }

    // Seed users
    await seedUsers();

    console.log('==========================================');
    console.log('✅ Seeding completed successfully!');
    console.log('==========================================');
    console.log(`\n📝 Total users in seed data: ${usersToSeed.length}`);
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

