const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

(async () => {
  const client = await pool.connect();
  try {
    // 1. Create schedule_scenarios table
    await client.query(`
      CREATE TABLE IF NOT EXISTS schedule_scenarios (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        operator_id UUID NOT NULL REFERENCES operators(id),
        scenario_number VARCHAR(10) NOT NULL,
        scenario_name VARCHAR(20) NOT NULL,
        description VARCHAR(100),
        period_start DATE NOT NULL,
        period_end DATE NOT NULL,
        season_code VARCHAR(5),
        is_private BOOLEAN DEFAULT false,
        created_by VARCHAR(100) DEFAULT 'admin',
        status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
        published_at TIMESTAMPTZ,
        published_by VARCHAR(100),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(operator_id, scenario_number)
      );
    `);
    console.log('1. Created schedule_scenarios table');

    // 2. Create indexes
    await client.query(`CREATE INDEX IF NOT EXISTS idx_scenarios_operator ON schedule_scenarios(operator_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_scenarios_status ON schedule_scenarios(status)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_scenarios_created_by ON schedule_scenarios(created_by)`);
    console.log('2. Created indexes');

    // 3. Create next_scenario_number function
    await client.query(`
      CREATE OR REPLACE FUNCTION next_scenario_number(
        p_operator_id UUID,
        p_created_by VARCHAR
      ) RETURNS VARCHAR AS $$
      DECLARE
        iata VARCHAR(2);
        next_num INTEGER;
      BEGIN
        SELECT iata_code INTO iata FROM operators WHERE id = p_operator_id;
        IF iata IS NULL THEN iata := 'XX'; END IF;

        SELECT MIN(candidate) INTO next_num
        FROM generate_series(1, 9999) AS candidate
        WHERE NOT EXISTS (
          SELECT 1 FROM schedule_scenarios
          WHERE operator_id = p_operator_id
          AND created_by = p_created_by
          AND scenario_number = iata || '-' || LPAD(candidate::TEXT, 4, '0')
        );

        RETURN iata || '-' || LPAD(next_num::TEXT, 4, '0');
      END;
      $$ LANGUAGE plpgsql;
    `);
    console.log('3. Created next_scenario_number function');

    // 4. Add scenario_id column to aircraft_routes
    await client.query(`ALTER TABLE aircraft_routes ADD COLUMN IF NOT EXISTS scenario_id UUID REFERENCES schedule_scenarios(id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_routes_scenario ON aircraft_routes(scenario_id)`);
    console.log('4. Added scenario_id to aircraft_routes');

    // 5. Migrate existing routes
    const { rows: ops } = await client.query(`SELECT DISTINCT operator_id FROM aircraft_routes WHERE scenario_id IS NULL`);
    console.log('5. Found', ops.length, 'operators with unlinked routes');

    for (const op of ops) {
      const { rows: opInfo } = await client.query(`SELECT iata_code FROM operators WHERE id = $1`, [op.operator_id]);
      const iata = opInfo[0]?.iata_code || 'XX';

      const { rows: dateRange } = await client.query(`
        SELECT COALESCE(MIN(period_start), '2025-12-01') as min_start,
               COALESCE(MAX(period_end), '2026-03-31') as max_end
        FROM aircraft_routes WHERE operator_id = $1
      `, [op.operator_id]);

      const { rows: newScenario } = await client.query(`
        INSERT INTO schedule_scenarios (
          operator_id, scenario_number, scenario_name, description,
          period_start, period_end, season_code, status, created_by
        ) VALUES ($1, $2, 'Initial', 'Migrated from initial build', $3, $4, 'W25', 'draft', 'system')
        ON CONFLICT (operator_id, scenario_number) DO UPDATE SET updated_at = NOW()
        RETURNING id
      `, [op.operator_id, iata + '-0001', dateRange[0].min_start, dateRange[0].max_end]);

      const scenarioId = newScenario[0].id;
      const { rowCount } = await client.query(`
        UPDATE aircraft_routes SET scenario_id = $1
        WHERE operator_id = $2 AND scenario_id IS NULL
      `, [scenarioId, op.operator_id]);
      console.log('   Migrated', rowCount, 'routes for operator', iata, '-> scenario', scenarioId);
    }

    // 6. Make scenario_id NOT NULL
    await client.query(`ALTER TABLE aircraft_routes ALTER COLUMN scenario_id SET NOT NULL`);
    console.log('6. Set scenario_id NOT NULL');

    console.log('DONE: All migrations complete');
  } catch (err) {
    console.error('ERROR:', err.message);
  } finally {
    client.release();
    pool.end();
  }
})();
