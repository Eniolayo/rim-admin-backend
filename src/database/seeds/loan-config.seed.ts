import dataSource from '../data-source';
import { SystemConfig } from '../../entities/system-config.entity';

interface LoanConfigSeedData {
  category: string;
  key: string;
  value: string | number | boolean | object | unknown[];
  description: string;
}

const loanConfigsToSeed: LoanConfigSeedData[] = [
  {
    category: 'loan',
    key: 'interest_rate.default',
    value: 5,
    description: 'Default interest rate percentage applied when not specified',
  },
  {
    category: 'loan',
    key: 'interest_rate.min',
    value: 1,
    description: 'Minimum allowed interest rate percentage',
  },
  {
    category: 'loan',
    key: 'interest_rate.max',
    value: 20,
    description: 'Maximum allowed interest rate percentage',
  },
  {
    category: 'loan',
    key: 'interest_rate.tiers',
    value: [
      { minScore: 0, maxScore: 500, rate: 10 },
      { minScore: 501, maxScore: 1000, rate: 7 },
      { minScore: 1001, maxScore: 9999, rate: 5 },
    ],
    description: 'Interest rate tiers based on credit score ranges',
  },
  {
    category: 'loan',
    key: 'repayment_period.default',
    value: 30,
    description: 'Default repayment period in days when not specified',
  },
  {
    category: 'loan',
    key: 'repayment_period.min',
    value: 7,
    description: 'Minimum allowed repayment period in days',
  },
  {
    category: 'loan',
    key: 'repayment_period.max',
    value: 90,
    description: 'Maximum allowed repayment period in days',
  },
  {
    category: 'loan',
    key: 'repayment_period.options',
    value: [
      { minScore: 0, maxScore: 500, period: 14 },
      { minScore: 501, maxScore: 1000, period: 30 },
      { minScore: 1001, maxScore: 9999, period: 60 },
    ],
    description: 'Repayment period options based on credit score ranges',
  },
];

async function seedLoanConfigs(): Promise<void> {
  console.log('🌱 Seeding Loan Configuration Settings...');
  const configRepository = dataSource.getRepository(SystemConfig);

  let createdCount = 0;
  let skippedCount = 0;

  for (const configData of loanConfigsToSeed) {
    const existingConfig = await configRepository.findOne({
      where: { category: configData.category, key: configData.key },
    });

    if (existingConfig) {
      console.log(
        `  ⏭️  Config already exists: ${configData.category}.${configData.key}`,
      );
      skippedCount++;
      continue;
    }

    console.log(`  Creating config: ${configData.category}.${configData.key}`);
    const config = configRepository.create({
      category: configData.category,
      key: configData.key,
      value: configData.value,
      description: configData.description,
      updatedBy: null,
    });

    await configRepository.save(config);
    console.log(
      `  ✅ Created config: ${configData.category}.${configData.key} - ${configData.description}`,
    );
    createdCount++;
  }

  console.log(
    `✅ Completed seeding Loan Configs: ${createdCount} created, ${skippedCount} skipped\n`,
  );
}

async function runSeed(): Promise<void> {
  console.log('==========================================');
  console.log('Loan Configuration Seeding Script');
  console.log('==========================================\n');

  try {
    // Initialize DataSource
    if (!dataSource.isInitialized) {
      console.log('📡 Connecting to database...');
      await dataSource.initialize();
      console.log('✅ Database connected\n');
    }

    // Seed loan configs
    await seedLoanConfigs();

    console.log('==========================================');
    console.log('✅ Seeding completed successfully!');
    console.log('==========================================');
    console.log(`\n📝 Total configs in seed data: ${loanConfigsToSeed.length}`);
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
