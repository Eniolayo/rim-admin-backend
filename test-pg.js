const { Client } = require('pg');

async function testConnection() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'rim_db_dev'
  });

  try {
    console.log('Attempting to connect to PostgreSQL...');
    await client.connect();
    console.log('Connected successfully!');
    
    const result = await client.query('SELECT 1 as test');
    console.log('Query result:', result.rows[0]);
    
    await client.end();
    console.log('Connection closed.');
  } catch (error) {
    console.error('Connection failed:', error.message);
    console.error('Full error:', error);
  }
}

testConnection();