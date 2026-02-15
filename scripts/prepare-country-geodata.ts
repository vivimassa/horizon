/**
 * Downloads Natural Earth 50m admin boundaries and splits into per-country GeoJSON files.
 * Output: /public/data/countries/{ISO_A2}.geojson
 */
import { writeFileSync, mkdirSync } from 'fs'
import { resolve } from 'path'

const NE_URL = 'https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@master/geojson/ne_50m_admin_0_countries.geojson'
const OUT_DIR = resolve(__dirname, '../public/data/countries')

async function main() {
  mkdirSync(OUT_DIR, { recursive: true })

  console.log('Downloading Natural Earth 50m countries (~24MB, compressed ~5MB)...')
  const res = await fetch(NE_URL)
  if (!res.ok) throw new Error(`Failed to fetch: ${res.status} ${res.statusText}`)

  console.log('Parsing GeoJSON...')
  const data = await res.json() as GeoJSON.FeatureCollection

  console.log(`Total features: ${data.features.length}`)

  // Group features by ISO_A2 code
  const byIso = new Map<string, GeoJSON.Feature[]>()

  for (const feature of data.features) {
    const props = feature.properties || {}
    // Try ISO_A2_EH first (more reliable for edge cases), fall back to ISO_A2
    let iso = props.ISO_A2_EH || props.ISO_A2
    if (!iso || iso === '-99' || iso === '-1') {
      // Some territories don't have a standard code; skip
      console.log(`  Skipping: ${props.NAME || 'unknown'} (no ISO code)`)
      continue
    }

    // Normalize
    iso = iso.toUpperCase()

    if (!byIso.has(iso)) byIso.set(iso, [])
    byIso.get(iso)!.push(feature)
  }

  console.log(`\nWriting ${byIso.size} country files...`)

  let written = 0
  for (const [iso, features] of byIso) {
    // Strip heavy properties, keep only essentials
    const cleanFeatures = features.map(f => ({
      type: 'Feature' as const,
      properties: {
        NAME: f.properties?.NAME || '',
        ISO_A2: iso,
      },
      geometry: f.geometry,
    }))

    const fc: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: cleanFeatures,
    }

    const outPath = resolve(OUT_DIR, `${iso}.geojson`)
    writeFileSync(outPath, JSON.stringify(fc))
    written++
  }

  console.log(`\nDone! Wrote ${written} files to ${OUT_DIR}`)

  // List some key countries to verify
  const check = ['VN', 'SG', 'HK', 'BN', 'TW', 'JP', 'US', 'AU', 'MO']
  console.log('\nVerification:')
  for (const iso of check) {
    const feats = byIso.get(iso)
    if (feats) {
      const totalCoords = feats.reduce((sum, f) => {
        const g = f.geometry as any
        if (g.type === 'Polygon') return sum + g.coordinates[0].length
        if (g.type === 'MultiPolygon') return sum + g.coordinates.reduce((s: number, p: any) => s + p[0].length, 0)
        return sum
      }, 0)
      console.log(`  ${iso}: ${feats.length} feature(s), ~${totalCoords} coordinates`)
    } else {
      console.log(`  ${iso}: NOT FOUND`)
    }
  }
}

main().catch(e => {
  console.error('Error:', e)
  process.exit(1)
})
