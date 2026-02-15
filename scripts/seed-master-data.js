const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  await client.connect();
  console.log('Connected.');

  // Get operator IDs
  const { rows: ops } = await client.query("SELECT id, name FROM operators");
  console.log('Operators:', ops.map(o => `${o.name} (${o.id})`).join(', '));

  const horizonOp = ops.find(o => o.name.toLowerCase().includes('horizon'));
  const vietjetOp = ops.find(o => o.name.toLowerCase().includes('vietjet'));

  if (!horizonOp) { console.log('No Horizon operator found!'); await client.end(); return; }
  console.log('Horizon:', horizonOp.id);
  if (vietjetOp) console.log('Vietjet:', vietjetOp.id);

  const allOperatorIds = [horizonOp.id];
  if (vietjetOp) allOperatorIds.push(vietjetOp.id);

  // ── 1. AIRLINES ──────────────────────────────────────────────────────────
  console.log('\n═══ AIRLINES ═══');

  const airlines = [
    { iata: 'VJ', icao: 'VJC', name: 'Vietjet Air', country: 'Vietnam', callsign: 'VIETJET AIR' },
    { iata: 'VN', icao: 'HVN', name: 'Vietnam Airlines', country: 'Vietnam', callsign: 'VIETNAM AIRLINES' },
    { iata: 'QH', icao: 'BAV', name: 'Bamboo Airways', country: 'Vietnam', callsign: 'BAMBOO AIRWAYS' },
    { iata: 'VU', icao: 'VAG', name: 'Vietravel Airlines', country: 'Vietnam', callsign: 'VIETRAVEL AIRLINES' },
    { iata: '9G', icao: 'SPQ', name: 'Sun PhuQuoc Airways', country: 'Vietnam', callsign: 'SUN PHUQUOC AIRWAYS' },
    { iata: 'HZ', icao: 'HZN', name: 'Horizon Airlines', country: 'Vietnam', callsign: 'HORIZON' },
    { iata: 'TG', icao: 'THA', name: 'Thai Airways', country: 'Thailand', callsign: 'THAI' },
    { iata: 'SQ', icao: 'SIA', name: 'Singapore Airlines', country: 'Singapore', callsign: 'SINGAPORE' },
    { iata: 'CX', icao: 'CPA', name: 'Cathay Pacific', country: 'Hong Kong', callsign: 'CATHAY' },
    { iata: 'KE', icao: 'KAL', name: 'Korean Air', country: 'South Korea', callsign: 'KOREAN AIR' },
    { iata: 'NH', icao: 'ANA', name: 'ANA', country: 'Japan', callsign: 'ALL NIPPON' },
    { iata: 'JL', icao: 'JAL', name: 'Japan Airlines', country: 'Japan', callsign: 'JAPAN AIR' },
    { iata: 'CZ', icao: 'CSN', name: 'China Southern', country: 'China', callsign: 'CHINA SOUTHERN' },
    { iata: 'QF', icao: 'QFA', name: 'Qantas', country: 'Australia', callsign: 'QANTAS' },
    { iata: 'EK', icao: 'UAE', name: 'Emirates', country: 'United Arab Emirates', callsign: 'EMIRATES' },
    { iata: 'BA', icao: 'BAW', name: 'British Airways', country: 'United Kingdom', callsign: 'SPEEDBIRD' },
    { iata: 'LH', icao: 'DLH', name: 'Lufthansa', country: 'Germany', callsign: 'LUFTHANSA' },
  ];

  let airlineCount = 0;
  for (const al of airlines) {
    const isOwn = al.icao === 'HZN';
    const { rowCount } = await client.query(
      `INSERT INTO airlines (icao_code, iata_code, name, country, callsign, operator_id, is_own_airline, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true)
       ON CONFLICT (icao_code) DO UPDATE SET
         iata_code = EXCLUDED.iata_code,
         name = EXCLUDED.name,
         country = EXCLUDED.country,
         callsign = EXCLUDED.callsign,
         operator_id = COALESCE(airlines.operator_id, EXCLUDED.operator_id),
         is_own_airline = EXCLUDED.is_own_airline`,
      [al.icao, al.iata, al.name, al.country, al.callsign, horizonOp.id, isOwn]
    );
    airlineCount++;
  }
  console.log(`Upserted ${airlineCount} airlines`);

  // ── 2. FLIGHT SERVICE TYPES ──────────────────────────────────────────────────
  console.log('\n═══ FLIGHT SERVICE TYPES ═══');

  const serviceTypes = [
    { code: 'J', name: 'Scheduled Passenger', color: '#22c55e' },
    { code: 'C', name: 'Charter', color: '#3b82f6' },
    { code: 'F', name: 'Ferry/Repositioning', color: '#f59e0b' },
    { code: 'G', name: 'Cargo', color: '#8b5cf6' },
    { code: 'P', name: 'Positioning', color: '#6b7280' },
    { code: 'H', name: 'Hajj', color: '#dc2626' },
    { code: 'T', name: 'Technical/Test', color: '#64748b' },
  ];

  for (const opId of allOperatorIds) {
    let count = 0;
    for (const st of serviceTypes) {
      const { rows: existing } = await client.query(
        'SELECT id FROM flight_service_types WHERE operator_id = $1 AND code = $2',
        [opId, st.code]
      );
      if (existing.length === 0) {
        await client.query(
          'INSERT INTO flight_service_types (operator_id, code, name, color, is_active) VALUES ($1, $2, $3, $4, true)',
          [opId, st.code, st.name, st.color]
        );
        count++;
      }
    }
    const opName = ops.find(o => o.id === opId)?.name || opId;
    console.log(`${opName}: inserted ${count} new service types`);
  }

  // ── 3. DELAY CODES ─────────────────────────────────────────────────────
  console.log('\n═══ DELAY CODES ═══');

  const delayCodes = [
    { code: '00', cat: 'Airline Internal', name: 'No Delay' },
    { code: '01', cat: 'Airline Internal', name: 'Airline Commercial/Dispatch' },
    { code: '03', cat: 'Airline Internal', name: 'Aircraft Rotation' },
    { code: '05', cat: 'Airline Internal', name: 'Airline Operations Control' },
    { code: '11', cat: 'Passenger/Baggage', name: 'Late Check-in' },
    { code: '12', cat: 'Passenger/Baggage', name: 'Late Boarding' },
    { code: '13', cat: 'Passenger/Baggage', name: 'Boarding: Discrepancies' },
    { code: '14', cat: 'Passenger/Baggage', name: 'Oversales' },
    { code: '15', cat: 'Passenger/Baggage', name: 'Boarding: Catering Order' },
    { code: '16', cat: 'Passenger/Baggage', name: 'Commercial Publicity/Passenger Convenience' },
    { code: '17', cat: 'Passenger/Baggage', name: 'Crew Requested by Passengers' },
    { code: '18', cat: 'Passenger/Baggage', name: 'Baggage Processing' },
    { code: '19', cat: 'Passenger/Baggage', name: 'Late Reduced Mobility Passengers' },
    { code: '21', cat: 'Cargo', name: 'Late Documentation' },
    { code: '22', cat: 'Cargo', name: 'Late Positioning' },
    { code: '23', cat: 'Cargo', name: 'Late Acceptance' },
    { code: '24', cat: 'Cargo', name: 'Inadequate Packing' },
    { code: '25', cat: 'Cargo', name: 'Overbooked' },
    { code: '26', cat: 'Cargo', name: 'Late Preparation in Warehouse' },
    { code: '27', cat: 'Cargo', name: 'Mail: Late Documentation/Positioning/Acceptance' },
    { code: '28', cat: 'Cargo', name: 'Cargo Overbooked' },
    { code: '31', cat: 'Aircraft/Ramp', name: 'Aircraft Documentation' },
    { code: '32', cat: 'Aircraft/Ramp', name: 'Loading/Unloading' },
    { code: '33', cat: 'Aircraft/Ramp', name: 'Loading Equipment' },
    { code: '34', cat: 'Aircraft/Ramp', name: 'Servicing Equipment' },
    { code: '35', cat: 'Aircraft/Ramp', name: 'Fueling' },
    { code: '36', cat: 'Aircraft/Ramp', name: 'Catering' },
    { code: '37', cat: 'Aircraft/Ramp', name: 'ULD/Container Shortage' },
    { code: '38', cat: 'Aircraft/Ramp', name: 'Ground Crew Shortage' },
    { code: '41', cat: 'Technical', name: 'Aircraft Defect' },
    { code: '42', cat: 'Technical', name: 'Scheduled Maintenance' },
    { code: '43', cat: 'Technical', name: 'Non-scheduled Maintenance' },
    { code: '44', cat: 'Technical', name: 'Unscheduled Maintenance' },
    { code: '45', cat: 'Technical', name: 'Aircraft Change' },
    { code: '46', cat: 'Technical', name: 'Aircraft on Ground (AOG) Spares' },
    { code: '47', cat: 'Technical', name: 'Standby Aircraft' },
    { code: '48', cat: 'Technical', name: 'Scheduled Cabin Configuration' },
    { code: '51', cat: 'Operations/Crew', name: 'Flight Plan' },
    { code: '52', cat: 'Operations/Crew', name: 'Crew Shortage' },
    { code: '53', cat: 'Operations/Crew', name: 'Crew Late' },
    { code: '54', cat: 'Operations/Crew', name: 'Training' },
    { code: '55', cat: 'Operations/Crew', name: 'Industrial Action (Own Airline)' },
    { code: '56', cat: 'Operations/Crew', name: 'Industrial Action (Outside)' },
    { code: '61', cat: 'Weather', name: 'Departure Weather Below Limits' },
    { code: '62', cat: 'Weather', name: 'Destination Weather Below Limits' },
    { code: '63', cat: 'Weather', name: 'En Route Weather' },
    { code: '64', cat: 'Weather', name: 'De-icing' },
    { code: '65', cat: 'Weather', name: 'Removal of De-icing Fluid' },
    { code: '66', cat: 'Weather', name: 'Ground Handling Impaired by Weather' },
    { code: '71', cat: 'ATC', name: 'ATC Departure' },
    { code: '72', cat: 'ATC', name: 'ATC En Route' },
    { code: '73', cat: 'ATC', name: 'ATC Destination' },
    { code: '75', cat: 'ATC', name: 'Mandatory Security' },
    { code: '76', cat: 'ATC', name: 'Immigration/Customs' },
    { code: '77', cat: 'ATC', name: 'Airport Facilities' },
    { code: '81', cat: 'Airport/Government', name: 'Airport Facilities Disruption' },
    { code: '82', cat: 'Airport/Government', name: 'Restrictions at Destination' },
    { code: '83', cat: 'Airport/Government', name: 'Restrictions at Airport of Departure' },
    { code: '84', cat: 'Airport/Government', name: 'Airport Curfew' },
    { code: '85', cat: 'Airport/Government', name: 'Noise Abatement' },
    { code: '86', cat: 'Airport/Government', name: 'ATC Staff Shortage' },
    { code: '87', cat: 'Airport/Government', name: 'Airport Closed' },
    { code: '93', cat: 'Misc', name: 'Reactionary: Previous Flight Operations' },
    { code: '94', cat: 'Misc', name: 'Reactionary: Previous Flight Technical' },
    { code: '95', cat: 'Misc', name: 'Reactionary: Previous Flight Passenger/Cargo' },
    { code: '96', cat: 'Misc', name: 'Reactionary: Previous Flight Other' },
    { code: '97', cat: 'Misc', name: 'Industrial Action' },
    { code: '98', cat: 'Misc', name: 'Airport Facilities' },
    { code: '99', cat: 'Misc', name: 'Miscellaneous' },
  ];

  for (const opId of allOperatorIds) {
    let count = 0;
    for (const dc of delayCodes) {
      const { rows: existing } = await client.query(
        'SELECT id FROM delay_codes WHERE operator_id = $1 AND code = $2',
        [opId, dc.code]
      );
      if (existing.length === 0) {
        await client.query(
          'INSERT INTO delay_codes (operator_id, code, category, name, is_active, is_iata_standard) VALUES ($1, $2, $3, $4, true, true)',
          [opId, dc.code, dc.cat, dc.name]
        );
        count++;
      }
    }
    const opName = ops.find(o => o.id === opId)?.name || opId;
    console.log(`${opName}: inserted ${count} new delay codes`);
  }

  // ── 4. CABIN CLASSES ─────────────────────────────────────────────────
  console.log('\n═══ CABIN CLASSES ═══');

  const cabinClasses = [
    { code: 'F', name: 'First Class', color: '#fbbf24', sort: 1 },
    { code: 'J', name: 'Business Class', color: '#3b82f6', sort: 2 },
    { code: 'W', name: 'Premium Economy', color: '#8b5cf6', sort: 3 },
    { code: 'Y', name: 'Economy', color: '#22c55e', sort: 4 },
  ];

  for (const opId of allOperatorIds) {
    let count = 0;
    for (const cc of cabinClasses) {
      const { rows: existing } = await client.query(
        'SELECT id FROM cabin_classes WHERE operator_id = $1 AND code = $2',
        [opId, cc.code]
      );
      if (existing.length === 0) {
        await client.query(
          'INSERT INTO cabin_classes (operator_id, code, name, color, sort_order, is_active) VALUES ($1, $2, $3, $4, $5, true)',
          [opId, cc.code, cc.name, cc.color, cc.sort]
        );
        count++;
      }
    }
    const opName = ops.find(o => o.id === opId)?.name || opId;
    console.log(`${opName}: inserted ${count} new cabin classes`);
  }

  // ── SUMMARY ──────────────────────────────────────────────────────
  console.log('\n═════════════════════════════════');
  console.log('       SEED SUMMARY');
  console.log('═════════════════════════════════');
  const { rows: alCount } = await client.query('SELECT count(*)::int as cnt FROM airlines');
  const { rows: stCount } = await client.query('SELECT count(*)::int as cnt FROM flight_service_types');
  const { rows: dcCount } = await client.query('SELECT count(*)::int as cnt FROM delay_codes');
  const { rows: ccCount } = await client.query('SELECT count(*)::int as cnt FROM cabin_classes');
  console.log(`  Airlines:             ${alCount[0].cnt}`);
  console.log(`  Flight Service Types: ${stCount[0].cnt}`);
  console.log(`  Delay Codes:          ${dcCount[0].cnt}`);
  console.log(`  Cabin Classes:        ${ccCount[0].cnt}`);
  console.log('═════════════════════════════════');

  await client.end();
  console.log('\nDone!');
}

run().catch(e => {
  console.error('Fatal:', e.message);
  client.end();
});
