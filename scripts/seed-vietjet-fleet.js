const { Client } = require('pg');

const client = new Client({
  host: 'aws-1-ap-northeast-2.pooler.supabase.com',
  port: 5432,
  user: 'postgres.qfaanyjjikvaubjnvqgb',
  password: 'Vietjet@129',
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
});

async function run() {
  await client.connect();
  console.log('Connected.');

  // ── 0. Get Vietjet operator_id ──
  const { rows: ops } = await client.query(
    "SELECT id, name FROM operators WHERE name ILIKE '%vietjet%' OR code ILIKE '%VJ%' LIMIT 1"
  );
  if (ops.length === 0) {
    console.log('No Vietjet operator found!');
    await client.end();
    return;
  }
  const operatorId = ops[0].id;
  console.log('Operator:', ops[0].name, operatorId);

  // ── 1. Get SGN airport id ──
  const { rows: sgn } = await client.query(
    "SELECT id FROM airports WHERE iata_code = 'SGN' LIMIT 1"
  );
  if (sgn.length === 0) {
    console.log('SGN airport not found!');
    await client.end();
    return;
  }
  const sgnId = sgn[0].id;
  console.log('SGN airport id:', sgnId);

  // ── 2. Check/create A21N type ──
  let { rows: a21nRows } = await client.query(
    'SELECT id FROM aircraft_types WHERE icao_type = $1 AND operator_id = $2 LIMIT 1',
    ['A21N', operatorId]
  );
  let a21nId;
  if (a21nRows.length > 0) {
    a21nId = a21nRows[0].id;
    console.log('A21N already exists:', a21nId);
  } else {
    // Get A321 image_url as fallback
    const { rows: a321img } = await client.query(
      "SELECT image_url FROM aircraft_types WHERE icao_type = 'A321' LIMIT 1"
    );
    const a321ImageUrl = a321img[0]?.image_url || null;

    const { rows: inserted } = await client.query(
      `INSERT INTO aircraft_types (
        operator_id, icao_type, iata_type_code, name, manufacturer, family, category,
        mtow_kg, mlw_kg, mzfw_kg, oew_kg, max_fuel_capacity_kg, fuel_burn_rate_kg_per_hour,
        cruising_speed_kts, cruising_mach, max_range_nm, min_runway_length_m, min_runway_width_m,
        fire_category, wake_turbulence_category, etops_capable, etops_max_minutes,
        autoland_capable, ils_category_required, default_tat_minutes,
        tat_dom_dom_minutes, tat_dom_int_minutes, tat_int_dom_minutes, tat_int_int_minutes,
        is_active, image_url
      ) VALUES (
        $1, 'A21N', '32Q', 'Airbus A321neo', 'Airbus', 'A320', 'narrow_body',
        97000, 79200, 73900, 50100, 23580, 2400,
        450, 0.78, 4000, 2200, 30,
        7, 'M', true, 180,
        true, 'Cat I', 40,
        35, 45, 45, 40,
        true, $2
      ) RETURNING id`,
      [operatorId, a321ImageUrl]
    );
    a21nId = inserted[0].id;
    console.log('Created A21N:', a21nId);
  }

  // ── 3. Check/create AJ27 type ──
  let { rows: aj27Rows } = await client.query(
    'SELECT id FROM aircraft_types WHERE icao_type = $1 AND operator_id = $2 LIMIT 1',
    ['AJ27', operatorId]
  );
  let aj27Id;
  if (aj27Rows.length > 0) {
    aj27Id = aj27Rows[0].id;
    console.log('AJ27 already exists:', aj27Id);
  } else {
    const { rows: inserted } = await client.query(
      `INSERT INTO aircraft_types (
        operator_id, icao_type, iata_type_code, name, manufacturer, family, category,
        mtow_kg, mlw_kg, mzfw_kg, oew_kg, max_fuel_capacity_kg, fuel_burn_rate_kg_per_hour,
        cruising_speed_kts, cruising_mach, max_range_nm, min_runway_length_m, min_runway_width_m,
        fire_category, wake_turbulence_category, etops_capable, autoland_capable,
        default_tat_minutes, is_active
      ) VALUES (
        $1, 'AJ27', 'AR1', 'Comac ARJ-21-700(ER)', 'Comac', 'ARJ21', 'regional',
        43500, 38500, 35000, 25500, 10000, 2200,
        420, 0.75, 1800, 1700, 30,
        6, 'M', false, false,
        35, true
      ) RETURNING id`,
      [operatorId]
    );
    aj27Id = inserted[0].id;
    console.log('Created AJ27:', aj27Id);
  }

  // ── 4. Get A320, A321, A333 type IDs ──
  const { rows: a320R } = await client.query(
    'SELECT id FROM aircraft_types WHERE icao_type = $1 AND operator_id = $2 LIMIT 1',
    ['A320', operatorId]
  );
  const { rows: a321R } = await client.query(
    'SELECT id FROM aircraft_types WHERE icao_type = $1 AND operator_id = $2 LIMIT 1',
    ['A321', operatorId]
  );
  const { rows: a333R } = await client.query(
    'SELECT id FROM aircraft_types WHERE icao_type = $1 AND operator_id = $2 LIMIT 1',
    ['A333', operatorId]
  );

  const a320Id = a320R[0]?.id;
  const a321Id = a321R[0]?.id;
  const a333Id = a333R[0]?.id;

  console.log('Type IDs:');
  console.log('  A320:', a320Id);
  console.log('  A321:', a321Id);
  console.log('  A21N:', a21nId);
  console.log('  A333:', a333Id);
  console.log('  AJ27:', aj27Id);

  if (!a320Id || !a321Id || !a333Id) {
    console.log('Missing aircraft types! Aborting.');
    await client.end();
    return;
  }

  // ── 5. Update A333 description ──
  await client.query(
    "UPDATE aircraft_types SET name = 'Airbus A330-343' WHERE id = $1",
    [a333Id]
  );
  console.log('\nUpdated A333 description to "Airbus A330-343"');

  // ── 6. Delete existing Vietjet registrations ──
  const { rowCount: delConfigs } = await client.query(
    'DELETE FROM aircraft_seating_configs WHERE aircraft_id IN (SELECT id FROM aircraft WHERE operator_id = $1)',
    [operatorId]
  );
  console.log('Deleted seating configs:', delConfigs || 0);

  const { rowCount: delAircraft } = await client.query(
    'DELETE FROM aircraft WHERE operator_id = $1',
    [operatorId]
  );
  console.log('Deleted aircraft:', delAircraft || 0);

  // ── 7. Define fleet ──
  const a320regs = [
    'VN-A650','VN-A655','VN-A656','VN-A658','VN-A662','VN-A663','VN-A666','VN-A668',
    'VN-A669','VN-A671','VN-A672','VN-A675','VN-A676','VN-A689','VN-A691','VN-A699',
  ];

  const a321regs = [
    'VN-A522','VN-A532','VN-A535','VN-A542','VN-A544','VN-A629','VN-A630','VN-A631',
    'VN-A632','VN-A633','VN-A634','VN-A635','VN-A636','VN-A637','VN-A639','VN-A640',
    'VN-A641','VN-A642','VN-A643','VN-A644','VN-A645','VN-A647','VN-A648','VN-A649',
    'VN-A651','VN-A657','VN-A661','VN-A667','VN-A670','VN-A673','VN-A677','VN-A683',
    'VN-A684','VN-A685','VN-A687','VN-A698',
  ];

  const a21nregs = [
    'VN-A500','VN-A516','VN-A523','VN-A525','VN-A526','VN-A527','VN-A528','VN-A529',
    'VN-A530','VN-A531','VN-A534','VN-A536','VN-A537','VN-A538','VN-A539','VN-A543',
    'VN-A545','VN-A546','VN-A547','VN-A548','VN-A549','VN-A550','VN-A551','VN-A552',
    'VN-A553','VN-A554','VN-A575','VN-A578','VN-A580','VN-A607','VN-A646','VN-A652',
    'VN-A653','VN-A654','VN-A674','VN-A693','VN-A694','VN-A697',
  ];

  const a333regs = [
    'VN-A810','VN-A811','VN-A812','VN-A814','VN-A815','VN-A816','VN-A817','VN-A820',
  ];

  const aj27regs = [
    'B-652G','B-656E',
  ];

  const fleet = [
    ...a320regs.map(r => ({ reg: r, typeId: a320Id, cabin: [{ class: 'Y', seats: 180 }], total: 180 })),
    ...a321regs.map(r => ({ reg: r, typeId: a321Id, cabin: [{ class: 'Y', seats: 230 }], total: 230 })),
    ...a21nregs.map(r => ({ reg: r, typeId: a21nId, cabin: [{ class: 'Y', seats: 236 }], total: 236 })),
    ...a333regs.map(r => ({ reg: r, typeId: a333Id, cabin: [{ class: 'J', seats: 24 }, { class: 'Y', seats: 353 }], total: 377 })),
    ...aj27regs.map(r => ({ reg: r, typeId: aj27Id, cabin: [{ class: 'Y', seats: 90 }], total: 90 })),
  ];

  console.log('\nInserting', fleet.length, 'aircraft...');

  let insertedCount = 0;
  let configCount = 0;
  const errors = [];

  for (const ac of fleet) {
    try {
      const { rows } = await client.query(
        `INSERT INTO aircraft (operator_id, registration, aircraft_type_id, status, home_base_id, is_active)
         VALUES ($1, $2, $3, 'active', $4, true)
         RETURNING id`,
        [operatorId, ac.reg, ac.typeId, sgnId]
      );
      insertedCount++;
      const aircraftId = rows[0].id;

      // Insert seating config
      await client.query(
        `INSERT INTO aircraft_seating_configs (aircraft_id, config_name, effective_from, cabin_config, total_capacity)
         VALUES ($1, 'Standard', '2020-01-01', $2, $3)`,
        [aircraftId, JSON.stringify(ac.cabin), ac.total]
      );
      configCount++;
    } catch (e) {
      errors.push(`${ac.reg}: ${e.message}`);
    }
  }

  if (errors.length > 0) {
    console.log('\nErrors:');
    errors.forEach(e => console.log('  ', e));
  }

  // ── 8. Verify ──
  console.log('\n═══════════════════════════════════');
  console.log('       VIETJET FLEET SUMMARY');
  console.log('═══════════════════════════════════');

  const { rows: counts } = await client.query(
    `SELECT at.icao_type, at.name, COUNT(a.id)::int as count
     FROM aircraft a
     JOIN aircraft_types at ON a.aircraft_type_id = at.id
     WHERE a.operator_id = $1
     GROUP BY at.icao_type, at.name
     ORDER BY at.icao_type`,
    [operatorId]
  );

  let total = 0;
  counts.forEach(r => {
    const padType = (r.icao_type + '   ').slice(0, 5);
    const padCount = (r.count + '   ').slice(0, 4);
    console.log(`  ${padType} ${r.name.padEnd(25)} ${padCount} aircraft`);
    total += r.count;
  });
  console.log('─────────────────────────────────');
  console.log(`  Total: ${total} aircraft`);

  const { rows: cfgCount } = await client.query(
    `SELECT COUNT(*)::int as cnt FROM aircraft_seating_configs
     WHERE aircraft_id IN (SELECT id FROM aircraft WHERE operator_id = $1)`,
    [operatorId]
  );
  console.log(`  Seating configs: ${cfgCount[0].cnt}`);
  console.log('═══════════════════════════════════');

  await client.end();
  console.log('\nDone!');
}

run().catch(e => {
  console.error('Fatal:', e.message);
  client.end();
});
