const { config } = require('dotenv');
const { resolve } = require('path');

// Load test environment first
config({ path: resolve(__dirname, '../.env.test') });

console.log('Environment variables loaded:');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_PORT:', process.env.DB_PORT);
console.log('DB_USERNAME:', process.env.DB_USERNAME);
console.log('DB_PASSWORD:', process.env.DB_PASSWORD);
console.log('DB_NAME:', process.env.DB_NAME);
console.log('JWT_SECRET length:', process.env.JWT_SECRET?.length);
console.log('JWT_REFRESH_SECRET length:', process.env.JWT_REFRESH_SECRET?.length);

async function testInit() {
  try {
    console.log('\nTesting AppModule import...');
    const { AppModule } = require('../dist/src/app.module');
    console.log('AppModule imported successfully');
    
    console.log('\nTesting data source...');
    const dataSource = require('../dist/src/database/data-source').default;
    console.log('Data source loaded');
    
    if (!dataSource.isInitialized) {
      console.log('Initializing data source...');
      await dataSource.initialize();
      console.log('Data source initialized');
      
      console.log('Running migrations...');
      await dataSource.runMigrations();
      console.log('Migrations completed');
    }
    
    console.log('\nAll tests passed!');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

testInit();