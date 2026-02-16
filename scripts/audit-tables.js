const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

(async () => {
  const r1 = await pool.query(`SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = 'flight_numbers' ORDER BY ordinal_position`);
  console.log('=== flight_numbers columns ===');
  r1.rows.forEach(r => console.log(r.column_name.padEnd(30) + r.data_type.padEnd(30) + 'nullable=' + r.is_nullable.padEnd(5) + ' default=' + (r.column_default || '')));

  console.log('');

  const r2 = await pool.query(`SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = 'scheduled_flights' ORDER BY ordinal_position`);
  console.log('=== scheduled_flights columns ===');
  r2.rows.forEach(r => console.log(r.column_name.padEnd(30) + r.data_type.padEnd(30) + 'nullable=' + r.is_nullable.padEnd(5) + ' default=' + (r.column_default || '')));

  console.log('');
  const c1 = await pool.query('SELECT COUNT(*) FROM flight_numbers');
  const c2 = await pool.query('SELECT COUNT(*) FROM scheduled_flights');
  console.log('flight_numbers count:', c1.rows[0].count);
  console.log('scheduled_flights count:', c2.rows[0].count);

  await pool.end();
})();
