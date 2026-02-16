const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

(async () => {
  try {
    // flight_numbers table
    const r1 = await pool.query('SELECT COUNT(*) FROM flight_numbers');
    console.log('flight_numbers count:', r1.rows[0].count);

    const r2 = await pool.query(
      `SELECT column_name, data_type, is_nullable, column_default
       FROM information_schema.columns
       WHERE table_name = 'flight_numbers' ORDER BY ordinal_position`
    );
    console.log('\nflight_numbers columns:');
    r2.rows.forEach(r => console.log('  ' + r.column_name.padEnd(25) + r.data_type.padEnd(25) + 'nullable=' + r.is_nullable));

    // scheduled_flights count
    const r3 = await pool.query('SELECT COUNT(*) FROM scheduled_flights');
    console.log('\nscheduled_flights count:', r3.rows[0].count);

    // Sample scheduled_flights
    const r4 = await pool.query(
      `SELECT flight_number, dep_station, arr_station, std_local, sta_local,
              days_of_operation, aircraft_type_icao, service_type,
              period_start, period_end, season_id, operator_id
       FROM scheduled_flights LIMIT 3`
    );
    console.log('\nSample scheduled_flights:');
    r4.rows.forEach(r => console.log(' ', JSON.stringify(r)));

    // Sample flight_numbers (if any)
    const r5 = await pool.query('SELECT * FROM flight_numbers LIMIT 3');
    console.log('\nSample flight_numbers:', r5.rows.length ? r5.rows : '(empty)');

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
})();
