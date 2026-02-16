'use server'

import { Pool } from 'pg'
import { getCurrentOperatorId } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

export interface UomSettings {
  id: string
  operator_id: string
  distance: string
  distance_commercial: string
  weight: string
  speed: string
  runway_length: string
  elevation: string
  temperature: string
  fuel_weight: string
  fuel_volume: string
  cargo_volume: string
  currency: string
  specific_gravity: number
  created_at: string
  updated_at: string
}

const DEFAULTS: Omit<UomSettings, 'id' | 'operator_id' | 'created_at' | 'updated_at'> = {
  distance: 'nm',
  distance_commercial: 'km',
  weight: 'kg',
  speed: 'kts',
  runway_length: 'm',
  elevation: 'ft',
  temperature: 'c',
  fuel_weight: 'kg',
  fuel_volume: 'usg',
  cargo_volume: 'm3',
  currency: 'USD',
  specific_gravity: 0.80,
}

export async function getUomSettings(): Promise<UomSettings | null> {
  const operatorId = await getCurrentOperatorId()
  const client = await pool.connect()
  try {
    const { rows } = await client.query(
      'SELECT * FROM operator_uom_settings WHERE operator_id = $1',
      [operatorId]
    )
    if (rows.length === 0) {
      // Auto-create defaults for this operator
      const { rows: inserted } = await client.query(
        'INSERT INTO operator_uom_settings (operator_id) VALUES ($1) RETURNING *',
        [operatorId]
      )
      return inserted[0] ?? null
    }
    return rows[0]
  } finally {
    client.release()
  }
}

export async function updateUomSettings(
  settings: Partial<Omit<UomSettings, 'id' | 'operator_id' | 'created_at' | 'updated_at'>>
): Promise<{ success?: boolean; error?: string }> {
  const operatorId = await getCurrentOperatorId()
  const client = await pool.connect()
  try {
    const fields = Object.keys(settings)
    const values = Object.values(settings)

    if (fields.length === 0) return { error: 'No fields to update' }

    const setClauses = fields.map((f, i) => `${f} = $${i + 1}`).join(', ')
    const query = `UPDATE operator_uom_settings SET ${setClauses}, updated_at = NOW() WHERE operator_id = $${fields.length + 1}`

    await client.query(query, [...values, operatorId])
    revalidatePath('/admin/master-database/units-of-measure')
    return { success: true }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    console.error('Error updating UOM settings:', message)
    return { error: message }
  } finally {
    client.release()
  }
}

export async function resetUomSettings(): Promise<{ success?: boolean; error?: string }> {
  const operatorId = await getCurrentOperatorId()
  const client = await pool.connect()
  try {
    await client.query(
      `UPDATE operator_uom_settings SET
        distance = $1, distance_commercial = $2, weight = $3, speed = $4,
        runway_length = $5, elevation = $6, temperature = $7, fuel_weight = $8,
        fuel_volume = $9, cargo_volume = $10, currency = $11, specific_gravity = $12,
        updated_at = NOW()
      WHERE operator_id = $13`,
      [
        DEFAULTS.distance, DEFAULTS.distance_commercial, DEFAULTS.weight, DEFAULTS.speed,
        DEFAULTS.runway_length, DEFAULTS.elevation, DEFAULTS.temperature, DEFAULTS.fuel_weight,
        DEFAULTS.fuel_volume, DEFAULTS.cargo_volume, DEFAULTS.currency, DEFAULTS.specific_gravity,
        operatorId
      ]
    )
    revalidatePath('/admin/master-database/units-of-measure')
    return { success: true }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    console.error('Error resetting UOM settings:', message)
    return { error: message }
  } finally {
    client.release()
  }
}
