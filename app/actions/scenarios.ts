'use server'

import { Pool } from 'pg'
import { createAdminClient, getCurrentOperatorId } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { ScheduleScenario } from '@/types/database'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

// ─── Get all scenarios for operator ─────────────────────────────────────

export async function getScenarios(): Promise<(ScheduleScenario & { route_count: number })[]> {
  const operatorId = await getCurrentOperatorId()
  const { rows } = await pool.query(`
    SELECT s.*,
      (SELECT COUNT(*) FROM aircraft_routes r WHERE r.scenario_id = s.id)::int AS route_count
    FROM schedule_scenarios s
    WHERE s.operator_id = $1
    ORDER BY s.created_at DESC
  `, [operatorId])
  return rows
}

// ─── Get single scenario ────────────────────────────────────────────────

export async function getScenario(id: string): Promise<ScheduleScenario | null> {
  const operatorId = await getCurrentOperatorId()
  const { rows } = await pool.query(
    `SELECT * FROM schedule_scenarios WHERE id = $1 AND operator_id = $2`,
    [id, operatorId]
  )
  return rows[0] || null
}

// ─── Get next scenario number ───────────────────────────────────────────

export async function getNextScenarioNumber(createdBy: string = 'admin'): Promise<string> {
  const operatorId = await getCurrentOperatorId()
  const { rows } = await pool.query(
    `SELECT next_scenario_number($1, $2) AS num`,
    [operatorId, createdBy]
  )
  return rows[0].num
}

// ─── Create scenario ────────────────────────────────────────────────────

export async function createScenario(data: {
  scenario_name: string
  period_start: string
  period_end: string
  season_code?: string
  description?: string
  is_private?: boolean
  created_by?: string
}): Promise<{ success?: boolean; error?: string; scenario?: ScheduleScenario }> {
  const operatorId = await getCurrentOperatorId()
  const createdBy = data.created_by || 'admin'

  // Get next number
  const { rows: numRows } = await pool.query(
    `SELECT next_scenario_number($1, $2) AS num`,
    [operatorId, createdBy]
  )
  const scenarioNumber = numRows[0].num

  try {
    const { rows } = await pool.query(`
      INSERT INTO schedule_scenarios (
        operator_id, scenario_number, scenario_name, description,
        period_start, period_end, season_code, is_private, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      operatorId,
      scenarioNumber,
      data.scenario_name,
      data.description || null,
      data.period_start,
      data.period_end,
      data.season_code || null,
      data.is_private ?? false,
      createdBy,
    ])

    revalidatePath('/network/control/schedule-builder')
    return { success: true, scenario: rows[0] }
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
}

// ─── Update scenario ────────────────────────────────────────────────────

export async function updateScenario(
  id: string,
  fields: Partial<Pick<ScheduleScenario, 'scenario_name' | 'description' | 'period_start' | 'period_end' | 'season_code' | 'is_private' | 'status'>>
): Promise<{ success?: boolean; error?: string }> {
  const operatorId = await getCurrentOperatorId()

  const setClauses: string[] = []
  const values: unknown[] = []
  let idx = 3

  for (const [key, val] of Object.entries(fields)) {
    setClauses.push(`${key} = $${idx}`)
    values.push(val)
    idx++
  }

  if (setClauses.length === 0) return { error: 'No fields to update' }

  setClauses.push(`updated_at = NOW()`)

  try {
    await pool.query(
      `UPDATE schedule_scenarios SET ${setClauses.join(', ')} WHERE id = $1 AND operator_id = $2`,
      [id, operatorId, ...values]
    )
    revalidatePath('/network/control/schedule-builder')
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
}

// ─── Delete scenario (only if no routes) ────────────────────────────────

export async function deleteScenario(id: string): Promise<{ success?: boolean; error?: string }> {
  const operatorId = await getCurrentOperatorId()

  // Check route count
  const { rows: countRows } = await pool.query(
    `SELECT COUNT(*)::int AS cnt FROM aircraft_routes WHERE scenario_id = $1`,
    [id]
  )
  if (countRows[0].cnt > 0) {
    return { error: `Cannot delete: scenario has ${countRows[0].cnt} route(s). Delete all routes first.` }
  }

  await pool.query(
    `DELETE FROM schedule_scenarios WHERE id = $1 AND operator_id = $2`,
    [id, operatorId]
  )

  revalidatePath('/network/control/schedule-builder')
  return { success: true }
}
