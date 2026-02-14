import pg from 'pg'
const { Client } = pg

const client = new Client({
  host: 'db.qfaanyjjikvaubjnvqgb.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'Vietjet@129',
  ssl: { rejectUnauthorized: false },
})

async function run() {
  await client.connect()
  console.log('Connected to database\n')

  // ─── Step 1: List all tables ───────────────────────────────
  console.log('=== EXISTING TABLES ===')
  const { rows: tables } = await client.query(`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  `)
  for (const t of tables) console.log(' ', t.tablename)
  console.log(`\nTotal: ${tables.length} tables\n`)

  // ─── Step 2: Drop ALL RLS policies + Disable RLS ──────────
  console.log('=== DROPPING ALL RLS POLICIES ===')
  for (const t of tables) {
    const { rows: policies } = await client.query(`
      SELECT policyname FROM pg_policies WHERE tablename = $1 AND schemaname = 'public'
    `, [t.tablename])
    for (const p of policies) {
      await client.query(`DROP POLICY IF EXISTS "${p.policyname}" ON "${t.tablename}"`)
      console.log(`  Dropped: ${t.tablename}.${p.policyname}`)
    }
  }
  console.log('\n=== DISABLING RLS ON ALL TABLES ===')
  for (const t of tables) {
    await client.query(`ALTER TABLE "${t.tablename}" DISABLE ROW LEVEL SECURITY`)
    console.log(`  Disabled RLS: ${t.tablename}`)
  }
  console.log()

  // ─── Step 3: Check columns + Create missing tables ────────
  console.log('=== CHECKING SCHEMA ===')

  // Helper to check if column exists
  async function columnExists(table, column) {
    const { rows } = await client.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2
    `, [table, column])
    return rows.length > 0
  }

  // Helper to check if table exists
  async function tableExists(table) {
    const { rows } = await client.query(`
      SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = $1
    `, [table])
    return rows.length > 0
  }

  // --- operators table: check for missing columns ---
  const opCols = ['code', 'iata_code', 'name', 'country', 'regulatory_authority', 'timezone']
  for (const col of opCols) {
    if (!(await columnExists('operators', col))) {
      const type = col === 'enabled_modules' ? 'text[]' : 'text'
      await client.query(`ALTER TABLE operators ADD COLUMN "${col}" ${type}`)
      console.log(`  Added column: operators.${col}`)
    }
  }

  // --- aircraft_types: default_tat_minutes, default_cabin_config ---
  if (!(await columnExists('aircraft_types', 'default_tat_minutes'))) {
    await client.query(`ALTER TABLE aircraft_types ADD COLUMN default_tat_minutes integer DEFAULT 45`)
    console.log('  Added column: aircraft_types.default_tat_minutes')
  }
  if (!(await columnExists('aircraft_types', 'default_cabin_config'))) {
    await client.query(`ALTER TABLE aircraft_types ADD COLUMN default_cabin_config jsonb`)
    console.log('  Added column: aircraft_types.default_cabin_config')
  }

  // --- aircraft table ---
  if (!(await tableExists('aircraft'))) {
    await client.query(`
      CREATE TABLE aircraft (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        registration text NOT NULL UNIQUE,
        aircraft_type_id uuid NOT NULL REFERENCES aircraft_types(id),
        status text NOT NULL DEFAULT 'active',
        home_base_id uuid REFERENCES airports(id),
        seating_config jsonb,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      )
    `)
    console.log('  Created table: aircraft')
  }

  // --- airport_tat_rules table ---
  if (!(await tableExists('airport_tat_rules'))) {
    await client.query(`
      CREATE TABLE airport_tat_rules (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        airport_id uuid NOT NULL REFERENCES airports(id),
        aircraft_type_id uuid NOT NULL REFERENCES aircraft_types(id),
        tat_minutes integer NOT NULL,
        notes text,
        is_active boolean DEFAULT true,
        created_at timestamptz DEFAULT now(),
        UNIQUE(airport_id, aircraft_type_id)
      )
    `)
    console.log('  Created table: airport_tat_rules')
  }

  // --- flight_service_types table ---
  if (!(await tableExists('flight_service_types'))) {
    await client.query(`
      CREATE TABLE flight_service_types (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        operator_id uuid NOT NULL REFERENCES operators(id),
        code varchar(5) NOT NULL,
        name varchar(50) NOT NULL,
        description text,
        color varchar(7),
        is_active boolean DEFAULT true,
        created_at timestamptz DEFAULT now(),
        UNIQUE(operator_id, code)
      )
    `)
    console.log('  Created table: flight_service_types')
  }

  // --- delay_codes table ---
  if (!(await tableExists('delay_codes'))) {
    await client.query(`
      CREATE TABLE delay_codes (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        operator_id uuid NOT NULL REFERENCES operators(id),
        code varchar(10) NOT NULL,
        category varchar(50) NOT NULL,
        name varchar(100) NOT NULL,
        description text,
        is_active boolean DEFAULT true,
        created_at timestamptz DEFAULT now(),
        UNIQUE(operator_id, code)
      )
    `)
    console.log('  Created table: delay_codes')
  }

  // --- schedule_seasons table ---
  if (!(await tableExists('schedule_seasons'))) {
    await client.query(`
      CREATE TABLE schedule_seasons (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        code text NOT NULL UNIQUE,
        name text NOT NULL,
        start_date date NOT NULL,
        end_date date NOT NULL,
        status text NOT NULL DEFAULT 'draft',
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      )
    `)
    console.log('  Created table: schedule_seasons')
  }

  // --- service_types table ---
  if (!(await tableExists('service_types'))) {
    await client.query(`
      CREATE TABLE service_types (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        code text NOT NULL UNIQUE,
        name text NOT NULL,
        description text,
        color text NOT NULL DEFAULT '#6B9DAD',
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      )
    `)
    console.log('  Created table: service_types')
  }

  // --- cabin_configurations table ---
  if (!(await tableExists('cabin_configurations'))) {
    await client.query(`
      CREATE TABLE cabin_configurations (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        aircraft_type text NOT NULL,
        name text NOT NULL,
        cabins jsonb NOT NULL DEFAULT '[]',
        total_seats integer NOT NULL,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now(),
        UNIQUE(aircraft_type, name)
      )
    `)
    console.log('  Created table: cabin_configurations')
  }

  // --- flight_numbers table ---
  if (!(await tableExists('flight_numbers'))) {
    await client.query(`
      CREATE TABLE flight_numbers (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        operator_id uuid NOT NULL REFERENCES operators(id),
        season_id uuid NOT NULL REFERENCES schedule_seasons(id),
        flight_number text NOT NULL,
        departure_iata text NOT NULL,
        arrival_iata text NOT NULL,
        std text NOT NULL DEFAULT '',
        sta text NOT NULL DEFAULT '',
        block_minutes integer NOT NULL DEFAULT 0,
        days_of_week text NOT NULL DEFAULT '1234567',
        aircraft_type_id uuid REFERENCES aircraft_types(id),
        service_type text DEFAULT 'J',
        effective_from date,
        effective_until date,
        arrival_day_offset integer DEFAULT 0,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now(),
        UNIQUE(operator_id, season_id, flight_number)
      )
    `)
    console.log('  Created table: flight_numbers')
  }

  // --- flights table ---
  if (!(await tableExists('flights'))) {
    await client.query(`
      CREATE TABLE flights (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        operator_id uuid NOT NULL REFERENCES operators(id),
        flight_number_id uuid REFERENCES flight_numbers(id) ON DELETE SET NULL,
        flight_number text NOT NULL,
        flight_date date NOT NULL,
        departure_iata text NOT NULL,
        arrival_iata text NOT NULL,
        std_utc timestamptz NOT NULL,
        sta_utc timestamptz NOT NULL,
        std_local text NOT NULL DEFAULT '',
        sta_local text NOT NULL DEFAULT '',
        block_minutes integer NOT NULL DEFAULT 0,
        aircraft_type_id uuid REFERENCES aircraft_types(id),
        aircraft_id uuid REFERENCES aircraft(id),
        service_type text NOT NULL DEFAULT 'J',
        status text NOT NULL DEFAULT 'scheduled',
        arrival_day_offset integer NOT NULL DEFAULT 0,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now(),
        UNIQUE(operator_id, flight_number, flight_date)
      )
    `)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_flights_date ON flights(flight_date)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_flights_operator_date ON flights(operator_id, flight_date)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_flights_status ON flights(status)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_flights_flight_number ON flights(flight_number)`)
    console.log('  Created table: flights')
  }

  // --- ssim_imports table ---
  if (!(await tableExists('ssim_imports'))) {
    await client.query(`
      CREATE TABLE ssim_imports (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        operator_id uuid NOT NULL REFERENCES operators(id),
        season_id uuid NOT NULL REFERENCES schedule_seasons(id),
        filename text,
        direction text NOT NULL DEFAULT 'import',
        total_records integer NOT NULL DEFAULT 0,
        new_records integer NOT NULL DEFAULT 0,
        updated_records integer NOT NULL DEFAULT 0,
        unchanged_records integer NOT NULL DEFAULT 0,
        error_records integer NOT NULL DEFAULT 0,
        errors jsonb DEFAULT '[]',
        created_at timestamptz DEFAULT now()
      )
    `)
    console.log('  Created table: ssim_imports')
  }

  // --- message_log table ---
  if (!(await tableExists('message_log'))) {
    await client.query(`
      CREATE TABLE message_log (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        operator_id uuid NOT NULL REFERENCES operators(id),
        message_type text NOT NULL,
        action_code text NOT NULL,
        direction text NOT NULL,
        flight_number text,
        flight_date text,
        status text NOT NULL DEFAULT 'pending',
        summary text,
        raw_message text,
        changes jsonb,
        reject_reason text,
        created_at timestamptz DEFAULT now()
      )
    `)
    console.log('  Created table: message_log')
  }

  // --- user_preferences table ---
  if (!(await tableExists('user_preferences'))) {
    await client.query(`
      CREATE TABLE user_preferences (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        theme text NOT NULL DEFAULT 'system',
        dock_position text NOT NULL DEFAULT 'bottom',
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now(),
        UNIQUE(user_id)
      )
    `)
    console.log('  Created table: user_preferences')
  }

  console.log()

  // ─── Step 4: Get operator ID for seeding ──────────────────
  console.log('=== OPERATOR INFO ===')
  const { rows: operators } = await client.query(`SELECT id, email, name, code, iata_code FROM operators LIMIT 5`)
  for (const op of operators) console.log(`  ${op.id} | ${op.email} | ${op.name} | ${op.code} | ${op.iata_code}`)

  const operatorId = operators[0]?.id
  if (!operatorId) {
    console.log('  No operator found! Cannot seed.')
    await client.end()
    return
  }
  console.log(`\n  Using operator: ${operatorId}\n`)

  // ─── Step 5: Seed data ────────────────────────────────────
  console.log('=== SEEDING DATA ===')

  // Schedule seasons S26 and W26
  await client.query(`
    INSERT INTO schedule_seasons (code, name, start_date, end_date, status) VALUES
    ('S26', 'Summer 2026', '2026-03-29', '2026-10-24', 'draft'),
    ('W26', 'Winter 2026/27', '2026-10-25', '2027-03-27', 'draft')
    ON CONFLICT (code) DO NOTHING
  `)
  console.log('  Seeded: schedule_seasons (S26, W26)')

  // Flight service types
  const fstCount = await client.query(`SELECT count(*) FROM flight_service_types WHERE operator_id = $1`, [operatorId])
  if (parseInt(fstCount.rows[0].count) === 0) {
    await client.query(`
      INSERT INTO flight_service_types (operator_id, code, name, description, color) VALUES
      ($1, 'J', 'Scheduled Passenger', 'Regular scheduled passenger service', '#2563EB'),
      ($1, 'C', 'Charter', 'Charter/ad-hoc passenger service', '#7C3AED'),
      ($1, 'F', 'Ferry/Positioning', 'Ferry or positioning flight without passengers', '#D97706'),
      ($1, 'G', 'Cargo', 'Dedicated cargo/freight service', '#059669'),
      ($1, 'P', 'Positioning', 'Aircraft positioning flight', '#6B7280')
      ON CONFLICT DO NOTHING
    `, [operatorId])
    console.log('  Seeded: flight_service_types (5 types)')
  } else {
    console.log(`  Skipped: flight_service_types (already has ${fstCount.rows[0].count} rows)`)
  }

  // Delay codes (subset of common ones)
  const dcCount = await client.query(`SELECT count(*) FROM delay_codes WHERE operator_id = $1`, [operatorId])
  if (parseInt(dcCount.rows[0].count) === 0) {
    await client.query(`
      INSERT INTO delay_codes (operator_id, code, category, name, description) VALUES
      ($1, '01', 'passenger', 'Late Passenger Check-in', 'Passengers arriving late at check-in counter'),
      ($1, '06', 'passenger', 'Passenger Documentation', 'Issues with passenger travel documents'),
      ($1, '15', 'cargo', 'Cargo Oversales', 'Cargo offloaded due to overbooking'),
      ($1, '35', 'aircraft_ramp', 'Aircraft Cleaning', 'Delay in cabin or aircraft cleaning'),
      ($1, '37', 'aircraft_ramp', 'Catering', 'Late or incomplete catering delivery'),
      ($1, '41', 'technical', 'Aircraft Defects', 'Aircraft technical defects or malfunctions'),
      ($1, '61', 'operations', 'Flight Plan', 'Late completion or change of flight plan'),
      ($1, '71', 'weather', 'Weather at Departure', 'Adverse weather at departure station'),
      ($1, '81', 'atc', 'ATFM En-Route Demand', 'ATFM restrictions due to en-route demand'),
      ($1, '93', 'reactionary', 'Aircraft Rotation', 'Late inbound aircraft from previous sector')
      ON CONFLICT DO NOTHING
    `, [operatorId])
    console.log('  Seeded: delay_codes (10 codes)')
  } else {
    console.log(`  Skipped: delay_codes (already has ${dcCount.rows[0].count} rows)`)
  }

  // Airport TAT rules (if airports + aircraft_types exist)
  const tatCount = await client.query(`SELECT count(*) FROM airport_tat_rules`)
  if (parseInt(tatCount.rows[0].count) === 0) {
    await client.query(`
      INSERT INTO airport_tat_rules (airport_id, aircraft_type_id, tat_minutes, notes)
      SELECT a.id, t.id, v.tat, v.notes
      FROM (VALUES
        ('VVTS', 'A320', 45, 'SGN standard turnaround'),
        ('VVTS', 'A321', 45, 'SGN standard turnaround'),
        ('VVNB', 'A320', 40, 'HAN standard turnaround'),
        ('VVNB', 'A321', 40, 'HAN standard turnaround')
      ) AS v(airport_icao, aircraft_icao, tat, notes)
      JOIN airports a ON a.icao_code = v.airport_icao
      JOIN aircraft_types t ON t.icao_type = v.aircraft_icao
      ON CONFLICT DO NOTHING
    `)
    console.log('  Seeded: airport_tat_rules')
  } else {
    console.log(`  Skipped: airport_tat_rules (already has ${tatCount.rows[0].count} rows)`)
  }

  // ─── Step 6: Test insert ──────────────────────────────────
  console.log('\n=== TEST: Insert schedule season ===')
  try {
    const { rows } = await client.query(`
      INSERT INTO schedule_seasons (code, name, start_date, end_date, status)
      VALUES ('TEST99', 'Test Season', '2099-01-01', '2099-06-30', 'draft')
      RETURNING id, code, name
    `)
    console.log(`  SUCCESS: Inserted ${rows[0].code} (${rows[0].name}) with id ${rows[0].id}`)

    // Clean up test
    await client.query(`DELETE FROM schedule_seasons WHERE code = 'TEST99'`)
    console.log('  Cleaned up test row')
  } catch (err) {
    console.error('  FAILED:', err.message)
  }

  // Final table list
  console.log('\n=== FINAL TABLE LIST ===')
  const { rows: finalTables } = await client.query(`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
  `)
  for (const t of finalTables) {
    const { rows: rlsCheck } = await client.query(`
      SELECT rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename = $1
    `, [t.tablename])
    const rls = rlsCheck[0]?.rowsecurity ? 'RLS ON' : 'RLS OFF'
    console.log(`  ${t.tablename} (${rls})`)
  }

  await client.end()
  console.log('\nDone!')
}

run().catch(err => { console.error('Fatal:', err); process.exit(1) })
