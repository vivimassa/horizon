const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

(async () => {
  try {
    // Step 1: Add missing columns to scheduled_flights
    console.log('=== Step 1: Adding missing columns to scheduled_flights ===');

    const alterSql = `
      ALTER TABLE scheduled_flights
        ADD COLUMN IF NOT EXISTS arrival_day_offset INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS cockpit_crew_required INTEGER,
        ADD COLUMN IF NOT EXISTS cabin_crew_required INTEGER,
        ADD COLUMN IF NOT EXISTS is_etops BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS is_overwater BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
    `;
    await pool.query(alterSql);
    console.log('Columns added successfully.');

    // Backfill arrival_day_offset for existing rows
    const backfill = await pool.query(`
      UPDATE scheduled_flights
      SET arrival_day_offset = CASE WHEN sta_local < std_local THEN 1 ELSE 0 END
      WHERE arrival_day_offset IS NULL OR arrival_day_offset = 0
    `);
    console.log('Backfilled arrival_day_offset:', backfill.rowCount, 'rows');

    // Also ensure source column has correct defaults for existing data
    const srcFix = await pool.query(`
      UPDATE scheduled_flights SET source = 'ssim' WHERE source IS NULL
    `);
    console.log('Fixed NULL source values:', srcFix.rowCount, 'rows');

    // Step 2: Check for any manual flight_numbers that need migration
    console.log('\n=== Step 2: Check flight_numbers for manual data ===');
    const fnCount = await pool.query('SELECT COUNT(*) FROM flight_numbers');
    console.log('flight_numbers total:', fnCount.rows[0].count);

    // Check if any flight_numbers don't have a matching scheduled_flight
    const unmatched = await pool.query(`
      SELECT fn.flight_number, fn.departure_iata, fn.arrival_iata, fn.std, fn.sta
      FROM flight_numbers fn
      WHERE NOT EXISTS (
        SELECT 1 FROM scheduled_flights sf
        WHERE sf.operator_id = fn.operator_id
          AND sf.season_id = fn.season_id
          AND sf.airline_code || sf.flight_number::text = fn.flight_number
          AND sf.dep_station = fn.departure_iata
          AND sf.arr_station = fn.arrival_iata
      )
      LIMIT 10
    `);
    console.log('Unmatched flight_numbers (not in scheduled_flights):', unmatched.rows.length);
    if (unmatched.rows.length > 0) {
      console.log('Samples:', unmatched.rows.slice(0, 5));
    }

    // Step 3: Verify scheduled_flights has all necessary columns
    console.log('\n=== Step 3: Verify scheduled_flights columns ===');
    const cols = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'scheduled_flights'
      ORDER BY ordinal_position
    `);
    console.log('scheduled_flights columns:');
    cols.rows.forEach(r => console.log('  ' + r.column_name.padEnd(25) + r.data_type.padEnd(25) + 'nullable=' + r.is_nullable));

    // Step 4: Rename flight_numbers to deprecated
    console.log('\n=== Step 4: Rename flight_numbers table ===');
    await pool.query('ALTER TABLE flight_numbers RENAME TO flight_numbers_deprecated');
    console.log('Renamed flight_numbers -> flight_numbers_deprecated');

    // Verify
    const sfCount = await pool.query('SELECT COUNT(*) FROM scheduled_flights');
    console.log('\nFinal scheduled_flights count:', sfCount.rows[0].count);

    const sourceBreakdown = await pool.query(`
      SELECT source, COUNT(*) FROM scheduled_flights GROUP BY source
    `);
    console.log('Source breakdown:', sourceBreakdown.rows);

  } catch (err) {
    console.error('Error:', err.message, err.detail || '');
  } finally {
    await pool.end();
  }
})();
