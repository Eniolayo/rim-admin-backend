const { Client } = require('pg');
const client = new Client({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'postgres',
  database: 'rim_db_dev'
});

client.connect()
  .then(() => {
    console.log('✅ Database connection successful!');
    return client.query('SELECT 1 as test');
  })
  .then((res) => {
    console.log('✅ Query result:', res.rows[0]);
    client.end();
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Database connection failed:', err.message);
    client.end();
    process.exit(1);
  });
