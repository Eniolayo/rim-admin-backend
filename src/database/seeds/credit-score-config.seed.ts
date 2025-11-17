import { DataSource } from 'typeorm'
import { SystemConfig } from '../../entities/system-config.entity'
import dataSource from '../data-source'

export async function runCreditScoreConfigSeed(dataSourceToUse: DataSource): Promise<void> {
  const repo = dataSourceToUse.getRepository(SystemConfig)
  const exists = await repo.findOne({ where: { category: 'credit_score', key: 'repayment_scoring' } })
  if (exists) {
    console.log('  ⏭️  Config already exists: credit_score.repayment_scoring')
    return
  }
  const value = {
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
  console.log('  Creating config: credit_score.repayment_scoring')
  const config = repo.create({ category: 'credit_score', key: 'repayment_scoring', value, description: 'Multiplier-based repayment scoring' })
  await repo.save(config)
  console.log('  ✅ Created config: credit_score.repayment_scoring - Multiplier-based repayment scoring')
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
