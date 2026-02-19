'use server'

import { Pool } from 'pg'
import { getCurrentOperatorId } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

// ─── Types ──────────────────────────────────────────────────────────────

export type ScheduleRule = {
  id: string
  operator_id: string
  name: string | null
  scope_type: 'all' | 'type' | 'family' | 'registration'
  scope_values: string[]
  action: 'must_fly' | 'should_fly' | 'must_not_fly' | 'should_avoid' | 'can_only_fly'
  criteria_type: 'airports' | 'routes' | 'international' | 'domestic' | 'service_type' | 'departure_time' | 'block_time' | 'overnight' | 'day_of_week' | 'country'
  criteria_values: Record<string, any>
  enforcement: 'hard' | 'soft'
  valid_from: string | null
  valid_to: string | null
  is_active: boolean
  priority: number
  notes: string | null
  created_at: string
  updated_at: string
}

export type ScheduleRuleInput = Omit<ScheduleRule, 'id' | 'operator_id' | 'created_at' | 'updated_at'>

// ─── Get all rules for operator ─────────────────────────────────────────

export async function getScheduleRules(): Promise<ScheduleRule[]> {
  const operatorId = await getCurrentOperatorId()
  const { rows } = await pool.query(
    `SELECT * FROM schedule_rules
     WHERE operator_id = $1
     ORDER BY priority ASC, created_at ASC`,
    [operatorId]
  )
  return rows
}

// ─── Get active rules (SQL-level filtering) ─────────────────────────────

export async function getActiveScheduleRules(): Promise<ScheduleRule[]> {
  const operatorId = await getCurrentOperatorId()
  const { rows } = await pool.query(
    `SELECT * FROM schedule_rules
     WHERE operator_id = $1
       AND is_active = true
       AND (valid_from IS NULL OR valid_from <= CURRENT_DATE)
       AND (valid_to   IS NULL OR valid_to   >= CURRENT_DATE)
     ORDER BY priority ASC, created_at ASC`,
    [operatorId]
  )
  return rows
}

// ─── Create rule ────────────────────────────────────────────────────────

export async function createScheduleRule(
  rule: ScheduleRuleInput
): Promise<{ data?: ScheduleRule; error?: string }> {
  const operatorId = await getCurrentOperatorId()

  try {
    const { rows } = await pool.query(
      `INSERT INTO schedule_rules (
        operator_id, name, scope_type, scope_values,
        action, criteria_type, criteria_values,
        enforcement, valid_from, valid_to,
        is_active, priority, notes
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING *`,
      [
        operatorId,
        rule.name,
        rule.scope_type,
        rule.scope_values,
        rule.action,
        rule.criteria_type,
        JSON.stringify(rule.criteria_values),
        rule.enforcement,
        rule.valid_from,
        rule.valid_to,
        rule.is_active,
        rule.priority,
        rule.notes,
      ]
    )
    revalidatePath('/admin/network-config/schedule-preferences')
    return { data: rows[0] }
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
}

// ─── Update rule ────────────────────────────────────────────────────────

export async function updateScheduleRule(
  id: string,
  updates: Partial<ScheduleRuleInput>
): Promise<{ error?: string }> {
  const operatorId = await getCurrentOperatorId()

  const setClauses: string[] = []
  const values: unknown[] = []
  let idx = 3 // $1 = id, $2 = operator_id

  for (const [key, val] of Object.entries(updates)) {
    if (key === 'criteria_values') {
      setClauses.push(`${key} = $${idx}`)
      values.push(JSON.stringify(val))
    } else {
      setClauses.push(`${key} = $${idx}`)
      values.push(val)
    }
    idx++
  }

  if (setClauses.length === 0) return { error: 'No fields to update' }
  setClauses.push('updated_at = NOW()')

  try {
    await pool.query(
      `UPDATE schedule_rules SET ${setClauses.join(', ')}
       WHERE id = $1 AND operator_id = $2`,
      [id, operatorId, ...values]
    )
    revalidatePath('/admin/network-config/schedule-preferences')
    return {}
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
}

// ─── Delete rule ────────────────────────────────────────────────────────

export async function deleteScheduleRule(id: string): Promise<{ error?: string }> {
  const operatorId = await getCurrentOperatorId()

  try {
    await pool.query(
      `DELETE FROM schedule_rules WHERE id = $1 AND operator_id = $2`,
      [id, operatorId]
    )
    revalidatePath('/admin/network-config/schedule-preferences')
    return {}
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
}

// ─── Toggle active ──────────────────────────────────────────────────────

export async function toggleScheduleRule(
  id: string,
  isActive: boolean
): Promise<{ error?: string }> {
  return updateScheduleRule(id, { is_active: isActive } as Partial<ScheduleRuleInput>)
}

// ─── Duplicate rule ─────────────────────────────────────────────────────

export async function duplicateScheduleRule(id: string): Promise<{ data?: ScheduleRule; error?: string }> {
  const operatorId = await getCurrentOperatorId()

  try {
    const { rows } = await pool.query(
      `INSERT INTO schedule_rules (
        operator_id, name, scope_type, scope_values,
        action, criteria_type, criteria_values,
        enforcement, valid_from, valid_to,
        is_active, priority, notes
      )
      SELECT
        operator_id, name || ' (copy)', scope_type, scope_values,
        action, criteria_type, criteria_values,
        enforcement, valid_from, valid_to,
        is_active, priority, notes
      FROM schedule_rules
      WHERE id = $1 AND operator_id = $2
      RETURNING *`,
      [id, operatorId]
    )
    if (rows.length === 0) return { error: 'Rule not found' }
    revalidatePath('/admin/network-config/schedule-preferences')
    return { data: rows[0] }
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
}

// ─── Reorder rules (transactional) ─────────────────────────────────────

export async function reorderScheduleRules(
  orderedIds: string[]
): Promise<{ error?: string }> {
  const operatorId = await getCurrentOperatorId()
  const client = await pool.connect()

  try {
    await client.query('BEGIN')
    for (let i = 0; i < orderedIds.length; i++) {
      await client.query(
        `UPDATE schedule_rules SET priority = $1, updated_at = NOW()
         WHERE id = $2 AND operator_id = $3`,
        [i + 1, orderedIds[i], operatorId]
      )
    }
    await client.query('COMMIT')
    revalidatePath('/admin/network-config/schedule-preferences')
    return {}
  } catch (err) {
    await client.query('ROLLBACK')
    return { error: err instanceof Error ? err.message : String(err) }
  } finally {
    client.release()
  }
}
