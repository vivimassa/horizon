const { Client } = require('pg');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const DELAY_MS = 3000;
const RETRY_DELAY_MS = 30000;
const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'images', 'aircraft', 'registrations');
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function fetch(url, redirectCount = 0) {
  if (redirectCount > 5) return Promise.reject(new Error('Too many redirects'));
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { headers: { 'User-Agent': USER_AGENT } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        let loc = res.headers.location;
        if (loc.startsWith('/')) {
          const u = new URL(url);
          loc = `${u.protocol}//${u.host}${loc}`;
        }
        return resolve(fetch(loc, redirectCount + 1));
      }
      if (res.statusCode === 429) {
        res.resume();
        return reject(new Error('RATE_LIMITED'));
      }
      if (res.statusCode === 404) {
        res.resume();
        return reject(new Error('NOT_FOUND'));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ body: Buffer.concat(chunks), headers: res.headers }));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

function extractPhotoUrl(html) {
  // Strategy 1: Look for og:image meta tag (usually the main aircraft photo)
  const ogMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i)
    || html.match(/<meta\s+content="([^"]+)"\s+property="og:image"/i);
  if (ogMatch && ogMatch[1] && ogMatch[1].includes('cdn.planespotters.net')) {
    return ogMatch[1];
  }

  // Strategy 2: Look for photo img src in the main content area
  const imgMatch = html.match(/src="(https:\/\/cdn\.planespotters\.net\/photo\/[^"]+)"/i);
  if (imgMatch) return imgMatch[1];

  // Strategy 3: Look for any planespotters CDN image
  const cdnMatch = html.match(/(https:\/\/cdn\.planespotters\.net\/[^"'\s]+\.(?:jpg|jpeg|png))/i);
  if (cdnMatch) return cdnMatch[1];

  return null;
}

async function downloadImage(url, filepath) {
  const { body } = await fetch(url);
  fs.writeFileSync(filepath, body);
  return body.length;
}

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('Connected to database.');

  // Get Vietjet operator
  const { rows: ops } = await client.query(
    "SELECT id FROM operators WHERE name ILIKE '%vietjet%' OR code ILIKE '%VJ%' LIMIT 1"
  );
  if (ops.length === 0) { console.log('No Vietjet operator found!'); await client.end(); return; }
  const operatorId = ops[0].id;

  // Get registrations without custom image
  const { rows: aircraft } = await client.query(
    `SELECT id, registration FROM aircraft
     WHERE operator_id = $1 AND (image_url IS NULL OR image_url = '')
     ORDER BY registration`,
    [operatorId]
  );

  console.log(`Found ${aircraft.length} aircraft without photos.\n`);
  if (aircraft.length === 0) { await client.end(); return; }

  let downloaded = 0;
  let skipped = 0;
  const failed = [];

  for (let i = 0; i < aircraft.length; i++) {
    const ac = aircraft[i];
    const reg = ac.registration;
    const regSlug = reg; // planespotters uses the reg as-is in the URL
    const filename = reg.toLowerCase() + '.jpg';
    const filepath = path.join(OUTPUT_DIR, filename);
    const dbPath = `/images/aircraft/registrations/${filename}`;

    try {
      // Step 1: Fetch the planespotters airframe page
      const pageUrl = `https://www.planespotters.net/airframe/${regSlug}`;
      let pageResult;
      try {
        pageResult = await fetch(pageUrl);
      } catch (err) {
        if (err.message === 'RATE_LIMITED') {
          console.log(`  [429] Rate limited on ${reg}, waiting 30s...`);
          await sleep(RETRY_DELAY_MS);
          pageResult = await fetch(pageUrl); // retry once
        } else {
          throw err;
        }
      }

      const html = pageResult.body.toString('utf-8');

      // Step 2: Extract photo URL
      const photoUrl = extractPhotoUrl(html);
      if (!photoUrl) {
        console.log(`  [SKIP] ${reg} — no photo URL found on page`);
        skipped++;
        failed.push({ reg, reason: 'No photo URL in HTML' });
        await sleep(DELAY_MS);
        continue;
      }

      // Step 3: Download the photo
      await sleep(DELAY_MS); // rate limit before image download too
      let imgResult;
      try {
        imgResult = await downloadImage(photoUrl, filepath);
      } catch (err) {
        if (err.message === 'RATE_LIMITED') {
          console.log(`  [429] Rate limited downloading image for ${reg}, waiting 30s...`);
          await sleep(RETRY_DELAY_MS);
          imgResult = await downloadImage(photoUrl, filepath);
        } else {
          throw err;
        }
      }

      // Step 4: Update database
      await client.query(
        'UPDATE aircraft SET image_url = $1 WHERE id = $2',
        [dbPath, ac.id]
      );

      downloaded++;
      const sizeKB = Math.round(imgResult / 1024);
      console.log(`  [OK]   ${reg} — ${sizeKB}KB`);

    } catch (err) {
      skipped++;
      const reason = err.message === 'NOT_FOUND' ? '404 page not found' : err.message;
      console.log(`  [FAIL] ${reg} — ${reason}`);
      failed.push({ reg, reason });
    }

    // Progress report every 10
    if ((i + 1) % 10 === 0) {
      console.log(`\n  ── Progress: ${i + 1}/${aircraft.length} processed (${downloaded} downloaded, ${skipped} skipped) ──\n`);
    }

    // Rate limit between registrations
    await sleep(DELAY_MS);
  }

  // Final report
  console.log('\n═══════════════════════════════════');
  console.log('       PHOTO CRAWL COMPLETE');
  console.log('═══════════════════════════════════');
  console.log(`  Downloaded: ${downloaded}`);
  console.log(`  Skipped:    ${skipped}`);
  console.log(`  Total:      ${aircraft.length}`);

  if (failed.length > 0) {
    console.log('\n  Failed registrations:');
    failed.forEach(f => console.log(`    ${f.reg}: ${f.reason}`));
  }

  console.log('═══════════════════════════════════');
  await client.end();
  console.log('\nDone!');
}

run().catch(e => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
