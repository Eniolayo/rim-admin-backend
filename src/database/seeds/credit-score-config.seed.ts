import { DataSource } from 'typeorm'
import { SystemConfig } from '../../entities/system-config.entity'
import dataSource from '../data-source'

export async function runCreditScoreConfigSeed(dataSourceToUse: DataSource): Promise<void> {
  const repo = dataSourceToUse.getRepository(SystemConfig)

  let createdCount = 0
  let skippedCount = 0

  const repaymentScoringValue = {
    basePoints: 50,
    amountMultipliers: [
      { minAmount: 0, maxAmount: 1000, multiplier: 0.5 },
      { minAmount: 1001, maxAmount: 5000, multiplier: 1.0 },
      { minAmount: 5001, maxAmount: 10000, multiplier: 1.5 },
      { minAmount: 10001, maxAmount: 999999, multiplier: 2.0 },
    ],
    durationMultipliers: [
      { minDays: 0, maxDays: 7, multiplier: 2.0 },
      { minDays: 8, maxDays: 14, multiplier: 1.5 },
      { minDays: 15, maxDays: 30, multiplier: 1.0 },
      { minDays: 31, maxDays: 60, multiplier: 0.75 },
      { minDays: 61, maxDays: 999, multiplier: 0.5 },
    ],
    maxPointsPerTransaction: 500,
    enablePartialRepayments: true,
    minPointsForPartialRepayment: 5,
  }

  const configsToSeed = [
    {
      category: 'credit_score',
      key: 'repayment_scoring',
      value: repaymentScoringValue,
      description: 'Multiplier-based repayment scoring',
    },
    {
      category: 'credit_score',
      key: 'first_timer_default_score',
      value: 100,
      description: 'Default credit score for first-time users',
    },
    {
      category: 'credit_score',
      key: 'max_score',
      value: 1000,
      description: 'Maximum allowed credit score for all users',
    },
  ]

  for (const cfg of configsToSeed) {
    const existing = await repo.findOne({ where: { category: cfg.category, key: cfg.key } })
    if (existing) {
      console.log(`  ⏭️  Config already exists: ${cfg.category}.${cfg.key}`)
      skippedCount++
      continue
    }
    console.log(`  Creating config: ${cfg.category}.${cfg.key}`)
    const config = repo.create({
      category: cfg.category,
      key: cfg.key,
      value: cfg.value,
      description: cfg.description,
      updatedBy: null,
    })
    await repo.save(config)
    console.log(`  ✅ Created config: ${cfg.category}.${cfg.key} - ${cfg.description}`)
    createdCount++
  }

  console.log(`✅ Completed seeding Credit Score Configs: ${createdCount} created, ${skippedCount} skipped`)
}

async function runSeed(): Promise<void> {
  console.log('==========================================')
  console.log('Credit Score Configuration Seeding Script')
  console.log('==========================================\n')

  try {
    // Initialize DataSource
    if (!dataSource.isInitialized) {
      console.log('📡 Connecting to database...')
      await dataSource.initialize()
      console.log('✅ Database connected\n')
    }

    console.log('🌱 Seeding Credit Score Configuration Settings...')
    await runCreditScoreConfigSeed(dataSource)

    console.log('\n==========================================')
    console.log('✅ Seeding completed successfully!')
    console.log('==========================================')
  } catch (error) {
    console.error('❌ Error during seeding:', error)
    throw error
  } finally {
    // Close DataSource connection
    if (dataSource.isInitialized) {
      await dataSource.destroy()
      console.log('📡 Database connection closed')
    }
  }
}

// Run the seed if this file is executed directly
if (require.main === module) {
  runSeed()
    .then(() => {
      console.log('✅ Seed script completed')
      process.exit(0)
    })
    .catch((error) => {
      console.error('❌ Seed script failed:', error)
      process.exit(1)
    })
}

export { runSeed }
