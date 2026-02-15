const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });
const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

(async () => {
  await client.connect();

  const { rows } = await client.query(`
    SELECT grantee, privilege_type, table_name
    FROM information_schema.table_privileges
    WHERE table_name IN ('aircraft', 'aircraft_seating_configs', 'aircraft_types', 'airports')
      AND grantee IN ('anon', 'authenticated')
    ORDER BY table_name, grantee, privilege_type
  `);

  console.log('Permissions:');
  rows.forEach(r => console.log(' ', r.table_name, '|', r.grantee, '|', r.privilege_type));

  const { rows: r2 } = await client.query(`
    SELECT relname, relrowsecurity FROM pg_class
    WHERE relname IN ('aircraft', 'aircraft_seating_configs')
  `);
  console.log('\nRLS status:');
  r2.forEach(r => console.log(' ', r.relname, ':', r.relrowsecurity));

  // Check RLS policies on aircraft_seating_configs
  const { rows: r3 } = await client.query(`
    SELECT tablename, policyname, cmd, qual FROM pg_policies
    WHERE tablename = 'aircraft_seating_configs'
  `);
  console.log('\nPolicies on aircraft_seating_configs:');
  r3.forEach(r => console.log(' ', r.policyname, '|', r.cmd, '|', r.qual));

  await client.end();
})();
