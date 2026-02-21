'use server'

import { Pool } from 'pg'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

// ─── Undo Payload Types ──────────────────────────────────────

export type UndoPayload =
  | {
      type: 'revert_move'
      flightIds: string[]
      originalRegs: Record<string, string | null>
    }
  | {
      type: 'revert_split'
      newRouteId: string
      sourceRouteId: string
      movedLegFlightIds: string[]
      originalRegs: Record<string, string | null>
    }
  | {
      type: 'delete_copies'
      newRouteId: string | null
      newFlightIds: string[]
    }

// ─── Move Full Route ─────────────────────────────────────────

/**
 * Move flights to a new aircraft registration.
 * Returns the original regs for undo.
 */
export async function moveFullRoute(
  flightIds: string[],
  targetReg: string
): Promise<{ undoPayload?: UndoPayload; error?: string }> {
  if (flightIds.length === 0) return { error: 'No flights to move' }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Capture original registrations
    const origRes = await client.query(
      `SELECT id, aircraft_reg FROM scheduled_flights WHERE id = ANY($1::uuid[])`,
      [flightIds]
    )
    const originalRegs: Record<string, string | null> = {}
    for (const row of origRes.rows) {
      originalRegs[row.id] = row.aircraft_reg ?? null
    }

    // Update aircraft_reg on all flights
    await client.query(
      `UPDATE scheduled_flights SET aircraft_reg = $1 WHERE id = ANY($2::uuid[])`,
      [targetReg, flightIds]
    )

    await client.query('COMMIT')

    return {
      undoPayload: {
        type: 'revert_move',
        flightIds,
        originalRegs,
      },
    }
  } catch (err) {
    await client.query('ROLLBACK')
    return { error: err instanceof Error ? err.message : String(err) }
  } finally {
    client.release()
  }
}

// ─── Split & Move Route ──────────────────────────────────────

/**
 * Split a route: move selected legs to a new route and reassign aircraft_reg.
 * - Creates a new route (copy source fields, append '-S' to route_name)
 * - Moves selected legs to new route (resequence from 1)
 * - Resequences remaining legs in source route
 * - Updates aircraft_reg on moved flights
 */
export async function splitAndMoveRoute(
  sourceRouteId: string,
  movedLegSequences: number[],
  targetReg: string
): Promise<{ undoPayload?: UndoPayload; error?: string }> {
  if (movedLegSequences.length === 0) return { error: 'No legs to move' }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // 1. Fetch source route
    const routeRes = await client.query(
      `SELECT * FROM aircraft_routes WHERE id = $1`,
      [sourceRouteId]
    )
    if (!routeRes.rows.length) {
      await client.query('ROLLBACK')
      return { error: 'Source route not found' }
    }
    const src = routeRes.rows[0]

    // 2. Create new route with -S suffix
    const newName = (src.route_name || 'Route') + '-S'
    const newRouteRes = await client.query(`
      INSERT INTO aircraft_routes (
        operator_id, season_id, scenario_id, route_name, aircraft_type_id,
        aircraft_type_icao, days_of_operation, period_start, period_end,
        duration_days, status, notes
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      RETURNING id
    `, [
      src.operator_id, src.season_id, src.scenario_id, newName,
      src.aircraft_type_id, src.aircraft_type_icao, src.days_of_operation,
      src.period_start, src.period_end, src.duration_days, src.status,
      src.notes,
    ])
    const newRouteId = newRouteRes.rows[0].id

    // 3. Fetch all legs of source route
    const legsRes = await client.query(
      `SELECT * FROM aircraft_route_legs WHERE route_id = $1 ORDER BY leg_sequence`,
      [sourceRouteId]
    )

    const movedSeqSet = new Set(movedLegSequences)
    const movedLegFlightIds: string[] = []
    const originalRegs: Record<string, string | null> = {}

    // 4. Move selected legs to new route
    let newSeq = 1
    for (const leg of legsRes.rows) {
      if (movedSeqSet.has(leg.leg_sequence)) {
        await client.query(
          `UPDATE aircraft_route_legs SET route_id = $1, leg_sequence = $2 WHERE id = $3`,
          [newRouteId, newSeq, leg.id]
        )
        newSeq++
        if (leg.flight_id) movedLegFlightIds.push(leg.flight_id)
      }
    }

    // 5. Resequence remaining legs in source route
    let srcSeq = 1
    for (const leg of legsRes.rows) {
      if (!movedSeqSet.has(leg.leg_sequence)) {
        await client.query(
          `UPDATE aircraft_route_legs SET leg_sequence = $1 WHERE id = $2`,
          [srcSeq, leg.id]
        )
        srcSeq++
      }
    }

    // 6. Capture original regs + update aircraft_reg on moved flights
    if (movedLegFlightIds.length > 0) {
      const origRes = await client.query(
        `SELECT id, aircraft_reg FROM scheduled_flights WHERE id = ANY($1::uuid[])`,
        [movedLegFlightIds]
      )
      for (const row of origRes.rows) {
        originalRegs[row.id] = row.aircraft_reg ?? null
      }
      await client.query(
        `UPDATE scheduled_flights SET aircraft_reg = $1 WHERE id = ANY($2::uuid[])`,
        [targetReg, movedLegFlightIds]
      )
    }

    await client.query('COMMIT')

    return {
      undoPayload: {
        type: 'revert_split',
        newRouteId,
        sourceRouteId,
        movedLegFlightIds,
        originalRegs,
      },
    }
  } catch (err) {
    await client.query('ROLLBACK')
    return { error: err instanceof Error ? err.message : String(err) }
  } finally {
    client.release()
  }
}

// ─── Copy Flights ────────────────────────────────────────────

/**
 * Duplicate flights as drafts with source='builder', assigned to targetReg.
 * If the flights are part of a route, create a new route for the copies.
 */
export async function copyFlights(
  flightIds: string[],
  targetReg: string,
  /** If flights come from a route, pass the route ID to clone the route structure */
  sourceRouteId: string | null
): Promise<{ undoPayload?: UndoPayload; error?: string }> {
  if (flightIds.length === 0) return { error: 'No flights to copy' }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const newFlightIds: string[] = []
    // Map old flight ID → new flight ID for route leg reassignment
    const oldToNew = new Map<string, string>()

    // 1. Copy each flight
    for (const fid of flightIds) {
      const res = await client.query(`
        INSERT INTO scheduled_flights (
          operator_id, season_id, airline_code, flight_number,
          dep_station, arr_station, std_utc, sta_utc,
          block_minutes, days_of_operation, period_start, period_end,
          aircraft_type_icao, aircraft_type_id, service_type,
          arrival_day_offset, source, status, aircraft_reg,
          dep_airport_id, arr_airport_id
        )
        SELECT
          operator_id, season_id, airline_code, flight_number,
          dep_station, arr_station, std_utc, sta_utc,
          block_minutes, days_of_operation, period_start, period_end,
          aircraft_type_icao, aircraft_type_id, service_type,
          arrival_day_offset, 'builder', 'draft', $2,
          dep_airport_id, arr_airport_id
        FROM scheduled_flights WHERE id = $1
        RETURNING id
      `, [fid, targetReg])
      const newId = res.rows[0].id
      newFlightIds.push(newId)
      oldToNew.set(fid, newId)
    }

    // 2. If source route, clone route + legs for copies
    let newRouteId: string | null = null
    if (sourceRouteId) {
      const routeRes = await client.query(
        `SELECT * FROM aircraft_routes WHERE id = $1`,
        [sourceRouteId]
      )
      if (routeRes.rows.length > 0) {
        const src = routeRes.rows[0]
        const newName = (src.route_name || 'Route') + '-Copy'
        const nrRes = await client.query(`
          INSERT INTO aircraft_routes (
            operator_id, season_id, scenario_id, route_name, aircraft_type_id,
            aircraft_type_icao, days_of_operation, period_start, period_end,
            duration_days, status, notes
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'draft',$11)
          RETURNING id
        `, [
          src.operator_id, src.season_id, src.scenario_id, newName,
          src.aircraft_type_id, src.aircraft_type_icao, src.days_of_operation,
          src.period_start, src.period_end, src.duration_days, src.notes,
        ])
        newRouteId = nrRes.rows[0].id

        // Copy legs, remapping flight_ids
        const legsRes = await client.query(
          `SELECT * FROM aircraft_route_legs WHERE route_id = $1 ORDER BY leg_sequence`,
          [sourceRouteId]
        )
        for (const leg of legsRes.rows) {
          const mappedFlightId = leg.flight_id ? (oldToNew.get(leg.flight_id) || null) : null
          // Only include legs whose flights were copied
          if (leg.flight_id && !oldToNew.has(leg.flight_id)) continue

          await client.query(`
            INSERT INTO aircraft_route_legs (
              route_id, leg_sequence, flight_id, airline_code, flight_number,
              dep_station, arr_station, std_utc, sta_utc,
              block_minutes, day_offset, arrives_next_day, service_type
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
          `, [
            newRouteId, leg.leg_sequence, mappedFlightId,
            leg.airline_code, leg.flight_number,
            leg.dep_station, leg.arr_station,
            leg.std_utc, leg.sta_utc,
            leg.block_minutes, leg.day_offset,
            leg.arrives_next_day, leg.service_type,
          ])
        }
      }
    }

    await client.query('COMMIT')

    return {
      undoPayload: {
        type: 'delete_copies',
        newRouteId,
        newFlightIds,
      },
    }
  } catch (err) {
    await client.query('ROLLBACK')
    return { error: err instanceof Error ? err.message : String(err) }
  } finally {
    client.release()
  }
}

// ─── Undo Paste ──────────────────────────────────────────────

/**
 * Reverse a paste operation using the stored undo payload.
 */
export async function undoPaste(
  payload: UndoPayload
): Promise<{ error?: string }> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    switch (payload.type) {
      case 'revert_move': {
        // Restore original aircraft_regs
        for (const [fid, origReg] of Object.entries(payload.originalRegs)) {
          await client.query(
            `UPDATE scheduled_flights SET aircraft_reg = $1 WHERE id = $2`,
            [origReg, fid]
          )
        }
        break
      }

      case 'revert_split': {
        // Move legs back from new route to source route
        const newLegsRes = await client.query(
          `SELECT * FROM aircraft_route_legs WHERE route_id = $1 ORDER BY leg_sequence`,
          [payload.newRouteId]
        )

        // Get current max sequence in source route
        const maxSeqRes = await client.query(
          `SELECT COALESCE(MAX(leg_sequence), 0) AS max_seq FROM aircraft_route_legs WHERE route_id = $1`,
          [payload.sourceRouteId]
        )
        let nextSeq = parseInt(maxSeqRes.rows[0].max_seq, 10) + 1

        // Move legs back to source
        for (const leg of newLegsRes.rows) {
          await client.query(
            `UPDATE aircraft_route_legs SET route_id = $1, leg_sequence = $2 WHERE id = $3`,
            [payload.sourceRouteId, nextSeq, leg.id]
          )
          nextSeq++
        }

        // Resequence source route by original order (sort by leg sequence to rebuild)
        const allSourceLegs = await client.query(
          `SELECT id FROM aircraft_route_legs WHERE route_id = $1 ORDER BY leg_sequence`,
          [payload.sourceRouteId]
        )
        let seq = 1
        for (const leg of allSourceLegs.rows) {
          await client.query(
            `UPDATE aircraft_route_legs SET leg_sequence = $1 WHERE id = $2`,
            [seq, leg.id]
          )
          seq++
        }

        // Delete the new route (now empty)
        await client.query(
          `DELETE FROM aircraft_routes WHERE id = $1`,
          [payload.newRouteId]
        )

        // Restore original regs
        for (const [fid, origReg] of Object.entries(payload.originalRegs)) {
          await client.query(
            `UPDATE scheduled_flights SET aircraft_reg = $1 WHERE id = $2`,
            [origReg, fid]
          )
        }
        break
      }

      case 'delete_copies': {
        // Delete the copied route (CASCADE deletes legs)
        if (payload.newRouteId) {
          await client.query(
            `DELETE FROM aircraft_routes WHERE id = $1`,
            [payload.newRouteId]
          )
        }
        // Delete the copied flights
        if (payload.newFlightIds.length > 0) {
          await client.query(
            `DELETE FROM scheduled_flights WHERE id = ANY($1::uuid[])`,
            [payload.newFlightIds]
          )
        }
        break
      }
    }

    await client.query('COMMIT')
    return {}
  } catch (err) {
    await client.query('ROLLBACK')
    return { error: err instanceof Error ? err.message : String(err) }
  } finally {
    client.release()
  }
}
