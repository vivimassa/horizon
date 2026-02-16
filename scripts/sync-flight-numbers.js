const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

(async () => {
  try {
    const operatorId = '515b5f97-a605-4bb6-af09-47100159e633'; // Vietjet
    const seasonId = '6c191b57-18c4-4228-8d83-30367c9af276';   // W25

    // Check scheduled_flights have airport refs
    const check = await pool.query(
      `SELECT COUNT(*) as total,
              COUNT(dep_airport_id) as with_dep,
              COUNT(arr_airport_id) as with_arr,
              COUNT(aircraft_type_id) as with_ac
       FROM scheduled_flights WHERE operator_id = $1 AND season_id = $2`,
      [operatorId, seasonId]
    );
    console.log('scheduled_flights refs:', check.rows[0]);

    // Update any missing airport refs first
    const u1 = await pool.query(`
      UPDATE scheduled_flights sf SET dep_airport_id = a.id
      FROM airports a
      WHERE sf.dep_station = a.iata_code AND sf.dep_airport_id IS NULL
        AND sf.operator_id = $1 AND sf.season_id = $2
    `, [operatorId, seasonId]);
    console.log('Updated dep_airport_id:', u1.rowCount);

    const u2 = await pool.query(`
      UPDATE scheduled_flights sf SET arr_airport_id = a.id
      FROM airports a
      WHERE sf.arr_station = a.iata_code AND sf.arr_airport_id IS NULL
        AND sf.operator_id = $1 AND sf.season_id = $2
    `, [operatorId, seasonId]);
    console.log('Updated arr_airport_id:', u2.rowCount);

    // Clear existing flight_numbers
    const del = await pool.query(
      'DELETE FROM flight_numbers WHERE operator_id = $1 AND season_id = $2',
      [operatorId, seasonId]
    );
    console.log('Cleared flight_numbers:', del.rowCount);

    // Sync
    const syncResult = await pool.query(`
      INSERT INTO flight_numbers (
        operator_id, season_id, flight_number, suffix,
        departure_airport_id, arrival_airport_id,
        departure_iata, arrival_iata,
        std_local, sta_local, std, sta,
        block_minutes, arrival_day_offset,
        days_of_operation, days_of_week,
        aircraft_type_id, service_type,
        effective_from, effective_until,
        is_etops, is_overwater, is_active
      )
      SELECT
        sf.operator_id,
        sf.season_id,
        sf.airline_code || sf.flight_number::text,
        NULL,
        sf.dep_airport_id,
        sf.arr_airport_id,
        sf.dep_station,
        sf.arr_station,
        sf.std_local,
        sf.sta_local,
        to_char(sf.std_local, 'HH24:MI'),
        to_char(sf.sta_local, 'HH24:MI'),
        COALESCE(sf.block_minutes, 0),
        CASE WHEN sf.sta_local < sf.std_local THEN 1 ELSE 0 END,
        sf.days_of_operation,
        sf.days_of_operation,
        COALESCE(sf.aircraft_type_id, (SELECT id FROM aircraft_types LIMIT 1)),
        sf.service_type,
        MIN(sf.period_start),
        MAX(sf.period_end),
        false,
        false,
        true
      FROM scheduled_flights sf
      WHERE sf.operator_id = $1
        AND sf.season_id = $2
        AND sf.dep_airport_id IS NOT NULL
        AND sf.arr_airport_id IS NOT NULL
      GROUP BY
        sf.operator_id, sf.season_id,
        sf.airline_code, sf.flight_number,
        sf.dep_airport_id, sf.arr_airport_id,
        sf.dep_station, sf.arr_station,
        sf.std_local, sf.sta_local,
        sf.block_minutes, sf.days_of_operation,
        sf.aircraft_type_id, sf.service_type
      ORDER BY sf.flight_number
    `, [operatorId, seasonId]);

    console.log('Synced flight_numbers:', syncResult.rowCount);

    // Verify
    const verify = await pool.query('SELECT COUNT(*) FROM flight_numbers WHERE season_id = $1', [seasonId]);
    console.log('flight_numbers count:', verify.rows[0].count);

    const sample = await pool.query(
      `SELECT flight_number, departure_iata, arrival_iata, std, sta, days_of_week, service_type, effective_from, effective_until
       FROM flight_numbers WHERE season_id = $1 ORDER BY flight_number LIMIT 5`,
      [seasonId]
    );
    console.log('\nSample flight_numbers:');
    sample.rows.forEach(r => console.log(' ', r.flight_number, r.departure_iata, '->', r.arrival_iata, r.std, '-', r.sta, 'DOW:', r.days_of_week, r.service_type));

  } catch (err) {
    console.error('Error:', err.message, err.detail || '');
  } finally {
    await pool.end();
  }
})();
