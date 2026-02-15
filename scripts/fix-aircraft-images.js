const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });
const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

// Map ICAO type to local image filename
const IMAGE_MAP = {
  A320: '/images/aircraft/a320.jpg',
  A321: '/images/aircraft/a320.jpg',   // same A320 family
  A21N: '/images/aircraft/a320.jpg',   // A321neo, same family
  A333: '/images/aircraft/a330.jpg',
};

(async () => {
  await client.connect();

  for (const [icao, path] of Object.entries(IMAGE_MAP)) {
    const { rowCount } = await client.query(
      'UPDATE aircraft_types SET image_url = $1 WHERE icao_type = $2',
      [path, icao]
    );
    console.log(`${icao} → ${path} (${rowCount} rows updated)`);
  }

  // Verify
  const { rows } = await client.query('SELECT icao_type, name, image_url FROM aircraft_types ORDER BY icao_type');
  console.log('\nVerification:');
  rows.forEach(r => console.log(`  ${r.icao_type} | ${r.name} | ${r.image_url}`));

  await client.end();
  console.log('\nDone!');
})();
