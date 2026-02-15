import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function run() {
  const { data: acTypes } = await s.from('aircraft_types').select('id, icao_type')
  const acMap = new Map<string, string>()
  for (const t of acTypes || []) acMap.set(t.icao_type, t.id)

  const a320 = acMap.get('A320')
  const a321 = acMap.get('A321')
  const a333 = acMap.get('A333')
  console.log('A320:', a320, 'A321:', a321, 'A333:', a333)

  const { data: airports } = await s.from('airports').select('id, iata_code')
  const iataMap = new Map<string, string>()
  for (const a of airports || []) { if (a.iata_code) iataMap.set(a.iata_code, a.id) }

  const { data: existing } = await s.from('airport_tat_rules').select('airport_id, aircraft_type_id')
  const existKeys = new Set((existing || []).map(e => `${e.airport_id}::${e.aircraft_type_id}`))

  const seeds = [
    // A333 seeds
    { iata: 'SGN', acId: a333, tat: 75, dd: 60, di: 80, id: 80, ii: 75 },
    { iata: 'HAN', acId: a333, tat: 70, dd: 55, di: 75, id: 75, ii: 70 },
    { iata: 'BKK', acId: a333, tat: 75, dd: 60, di: 80, id: 80, ii: 75 },
    { iata: 'SIN', acId: a333, tat: 60, dd: 50, di: 65, id: 65, ii: 60 },
    // Missing A320/A321 seeds
    { iata: 'SGN', acId: a320, tat: 45, dd: 35, di: 50, id: 50, ii: 45 },
    { iata: 'SGN', acId: a321, tat: 45, dd: 35, di: 50, id: 50, ii: 45 },
    { iata: 'HAN', acId: a320, tat: 40, dd: 30, di: 45, id: 45, ii: 40 },
    { iata: 'HAN', acId: a321, tat: 40, dd: 30, di: 45, id: 45, ii: 40 },
    { iata: 'DAD', acId: a320, tat: 35, dd: 30, di: 40, id: 40, ii: 35 },
    { iata: 'DAD', acId: a321, tat: 35, dd: 30, di: 40, id: 40, ii: 35 },
    { iata: 'CXR', acId: a320, tat: 35, dd: 30, di: 40, id: 40, ii: 35 },
    { iata: 'BKK', acId: a320, tat: 45, dd: 35, di: 50, id: 50, ii: 45 },
    { iata: 'SIN', acId: a320, tat: 40, dd: 35, di: 45, id: 45, ii: 40 },
  ]

  let seeded = 0
  for (const seed of seeds) {
    const aptId = iataMap.get(seed.iata)
    if (!aptId) { console.log('Skip:', seed.iata, 'not found'); continue }
    if (!seed.acId) { console.log('Skip:', seed.iata, 'ac type not found'); continue }

    const key = `${aptId}::${seed.acId}`
    if (existKeys.has(key)) { console.log('Already exists:', seed.iata); continue }

    const { error } = await s.from('airport_tat_rules').insert({
      airport_id: aptId,
      aircraft_type_id: seed.acId,
      tat_minutes: seed.tat,
      tat_dom_dom_minutes: seed.dd,
      tat_dom_int_minutes: seed.di,
      tat_int_dom_minutes: seed.id,
      tat_int_int_minutes: seed.ii,
    })
    if (error) console.log('Error:', seed.iata, error.message)
    else { seeded++; console.log('Seeded:', seed.iata) }
  }
  console.log('Total TAT rules seeded:', seeded)
}
run()
