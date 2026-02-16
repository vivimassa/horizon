'use server'

import { createClient, createAdminClient, getCurrentOperatorId } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { AircraftType, AircraftTypeSeatingConfig } from '@/types/database'
import { hhmmToMinutes } from '@/lib/utils'

const REVALIDATE_PATH = '/admin/master-database/aircraft-types'

// ─── Allowed fields for inline update ────────────────────────────────────
const ALLOWED_FIELDS = [
  'icao_type', 'iata_type', 'iata_type_code', 'name', 'family', 'category',
  'manufacturer', 'pax_capacity', 'cockpit_crew_required', 'cabin_crew_required',
  'default_tat_minutes', 'is_active', 'image_url',
  'mtow_kg', 'mlw_kg', 'mzfw_kg', 'oew_kg',
  'max_fuel_capacity_kg', 'fuel_unit', 'fuel_burn_rate_kg_per_hour',
  'max_range_nm', 'cruising_speed_kts', 'cruising_mach',
  'min_runway_length_m', 'min_runway_width_m',
  'fire_category', 'wake_turbulence_category',
  'etops_capable', 'etops_max_minutes',
  'noise_category', 'emissions_class',
  'tat_dom_dom_minutes', 'tat_dom_int_minutes', 'tat_int_dom_minutes', 'tat_int_int_minutes',
  'max_cargo_weight_kg', 'cargo_positions', 'uld_types_accepted', 'bulk_hold_capacity_kg',
  'cockpit_rest_facility_class', 'cabin_rest_facility_class',
  'cockpit_rest_positions', 'cabin_rest_positions',
  'weather_limitations', 'ils_category_required', 'autoland_capable',
  'notes',
] as const

// ─── Fetch ───────────────────────────────────────────────────────────────

export async function getAircraftTypes(): Promise<AircraftType[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('aircraft_types')
    .select('*')
    .order('icao_type', { ascending: true })

  if (error) {
    console.error('Error fetching aircraft types:', error)
    return []
  }
  return data || []
}

export async function getAircraftTypeSeatingConfigs(aircraftTypeId: string): Promise<AircraftTypeSeatingConfig[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('aircraft_type_seating_configs')
    .select('*')
    .eq('aircraft_type_id', aircraftTypeId)
    .order('is_default', { ascending: false })

  if (error) {
    console.error('Error fetching seating configs:', error)
    return []
  }
  return data || []
}

export async function getAllSeatingConfigs(): Promise<AircraftTypeSeatingConfig[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('aircraft_type_seating_configs')
    .select('*')
    .order('is_default', { ascending: false })

  if (error) {
    console.error('Error fetching all seating configs:', error)
    return []
  }
  return data || []
}

// ─── Create ──────────────────────────────────────────────────────────────

export async function createAircraftType(formData: FormData) {
  const supabase = createAdminClient()
  const operatorId = await getCurrentOperatorId()

  let defaultCabinConfig = null
  const cabinConfigStr = formData.get('default_cabin_config') as string
  if (cabinConfigStr) {
    try { defaultCabinConfig = JSON.parse(cabinConfigStr) } catch { /* ignore */ }
  }

  const aircraftData = {
    operator_id: operatorId,
    icao_type: formData.get('icao_type') as string,
    iata_type: formData.get('iata_type') as string || null,
    iata_type_code: formData.get('iata_type_code') as string || null,
    name: formData.get('name') as string,
    family: formData.get('family') as string || null,
    category: formData.get('category') as string || 'narrow_body',
    manufacturer: formData.get('manufacturer') as string || null,
    pax_capacity: parseInt(formData.get('pax_capacity') as string) || null,
    cockpit_crew_required: parseInt(formData.get('cockpit_crew') as string) || 2,
    cabin_crew_required: parseInt(formData.get('cabin_crew') as string) || null,
    default_tat_minutes: hhmmToMinutes(formData.get('default_tat_minutes') as string || '') ?? null,
    default_cabin_config: defaultCabinConfig,
  }

  if (!aircraftData.icao_type || !aircraftData.name) {
    return { error: 'ICAO code and name are required' }
  }

  const { error } = await supabase.from('aircraft_types').insert(aircraftData)
  if (error) {
    if (error.code === '23505') return { error: 'An aircraft type with this ICAO code already exists' }
    return { error: error.message }
  }

  revalidatePath(REVALIDATE_PATH)
  return { success: true }
}

// ─── Update ──────────────────────────────────────────────────────────────

export async function updateAircraftType(id: string, formData: FormData) {
  const supabase = createAdminClient()

  let defaultCabinConfig = null
  const cabinConfigStr = formData.get('default_cabin_config') as string
  if (cabinConfigStr) {
    try { defaultCabinConfig = JSON.parse(cabinConfigStr) } catch { /* ignore */ }
  }

  const aircraftData = {
    icao_type: formData.get('icao_type') as string,
    iata_type: formData.get('iata_type') as string || null,
    iata_type_code: formData.get('iata_type_code') as string || null,
    name: formData.get('name') as string,
    family: formData.get('family') as string || null,
    category: formData.get('category') as string,
    manufacturer: formData.get('manufacturer') as string || null,
    pax_capacity: parseInt(formData.get('pax_capacity') as string) || null,
    cockpit_crew_required: parseInt(formData.get('cockpit_crew') as string) || 2,
    cabin_crew_required: parseInt(formData.get('cabin_crew') as string) || null,
    default_tat_minutes: hhmmToMinutes(formData.get('default_tat_minutes') as string || '') ?? null,
    default_cabin_config: defaultCabinConfig,
  }

  if (!aircraftData.icao_type || !aircraftData.name) {
    return { error: 'ICAO code and name are required' }
  }

  const { error } = await supabase.from('aircraft_types').update(aircraftData).eq('id', id)
  if (error) {
    if (error.code === '23505') return { error: 'An aircraft type with this ICAO code already exists' }
    return { error: error.message }
  }

  revalidatePath(REVALIDATE_PATH)
  return { success: true }
}

// ─── Inline field update ─────────────────────────────────────────────────

export async function updateAircraftTypeField(
  id: string,
  field: string,
  value: string | number | boolean | null | Record<string, unknown>
) {
  if (!(ALLOWED_FIELDS as readonly string[]).includes(field)) {
    return { error: 'Invalid field' }
  }

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('aircraft_types')
    .update({ [field]: value })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath(REVALIDATE_PATH)
  return { success: true }
}

// ─── Check registrations ────────────────────────────────────────────────

export async function getAircraftRegistrationCount(aircraftTypeId: string): Promise<number> {
  const supabase = createAdminClient()
  const { count } = await supabase
    .from('aircraft')
    .select('*', { count: 'exact', head: true })
    .eq('aircraft_type_id', aircraftTypeId)
  return count ?? 0
}

// ─── Delete ──────────────────────────────────────────────────────────────

export async function deleteAircraftType(id: string) {
  // Safety check: cannot delete if registrations exist
  const count = await getAircraftRegistrationCount(id)
  if (count > 0) {
    return { error: `Cannot delete: ${count} registered aircraft reference this type` }
  }

  const supabase = createAdminClient()
  const { error } = await supabase.from('aircraft_types').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath(REVALIDATE_PATH)
  return { success: true }
}

// ─── Seating Config CRUD ─────────────────────────────────────────────────

export async function createSeatingConfig(
  aircraftTypeId: string,
  configName: string,
  cabinConfig: { class: string; seats: number }[],
  isDefault: boolean
) {
  const supabase = createAdminClient()

  // If setting as default, unset other defaults first
  if (isDefault) {
    await supabase
      .from('aircraft_type_seating_configs')
      .update({ is_default: false })
      .eq('aircraft_type_id', aircraftTypeId)
  }

  const { error } = await supabase.from('aircraft_type_seating_configs').insert({
    aircraft_type_id: aircraftTypeId,
    config_name: configName,
    cabin_config: cabinConfig,
    is_default: isDefault,
  })

  if (error) return { error: error.message }
  revalidatePath(REVALIDATE_PATH)
  return { success: true }
}

export async function updateSeatingConfig(
  id: string,
  configName: string,
  cabinConfig: { class: string; seats: number }[],
  isDefault: boolean,
  aircraftTypeId: string
) {
  const supabase = createAdminClient()

  if (isDefault) {
    await supabase
      .from('aircraft_type_seating_configs')
      .update({ is_default: false })
      .eq('aircraft_type_id', aircraftTypeId)
  }

  const { error } = await supabase
    .from('aircraft_type_seating_configs')
    .update({ config_name: configName, cabin_config: cabinConfig, is_default: isDefault })
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath(REVALIDATE_PATH)
  return { success: true }
}

export async function deleteSeatingConfig(id: string) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('aircraft_type_seating_configs').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath(REVALIDATE_PATH)
  return { success: true }
}
