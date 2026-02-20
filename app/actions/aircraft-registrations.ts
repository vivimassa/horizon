'use server'

import { createClient, createAdminClient, getCurrentOperatorId } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { Aircraft, AircraftType, AircraftSeatingConfig } from '@/types/database'

const REVALIDATE_PATH = '/admin/master-database/aircraft-registrations'

// ─── Types ───────────────────────────────────────────────────────────────

export interface AircraftWithRelations extends Aircraft {
  aircraft_types: {
    id: string
    icao_type: string
    name: string
    image_url: string | null
    category: string
    mtow_kg: number | null
    max_range_nm: number | null
    fuel_burn_rate_kg_per_hour: number | null
    pax_capacity: number | null
    family: string | null
    cockpit_rest_facility_class: string | null
    cabin_rest_facility_class: string | null
    cockpit_rest_positions: number | null
    cabin_rest_positions: number | null
  } | null
  home_base: { id: string; iata_code: string | null; icao_code: string; name: string } | null
  current_location: { id: string; iata_code: string | null; icao_code: string; name: string } | null
}

// ─── Allowed fields for inline update ────────────────────────────────────

const ALLOWED_FIELDS = [
  'registration', 'aircraft_type_id', 'serial_number', 'sub_operator',
  'status', 'home_base_id', 'date_of_manufacture', 'date_of_delivery',
  'lease_expiry_date', 'image_url', 'notes',
  'current_location_id', 'current_location_updated_at',
  'flight_hours_total', 'cycles_total',
  'next_maintenance_due', 'last_maintenance_date', 'last_maintenance_description',
  'aircraft_version', 'variant', 'performance_factor',
  'mtow_kg_override', 'max_range_nm_override',
  'cockpit_rest_facility_class_override', 'cabin_rest_facility_class_override',
  'cockpit_rest_positions_override', 'cabin_rest_positions_override',
] as const

// ─── Fetch ───────────────────────────────────────────────────────────────

export async function getAircraftRegistrations(): Promise<AircraftWithRelations[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('aircraft')
    .select(`
      *,
      aircraft_types!aircraft_type_id (
        id, icao_type, name, image_url, category,
        mtow_kg, max_range_nm, fuel_burn_rate_kg_per_hour, pax_capacity, family,
        cockpit_rest_facility_class, cabin_rest_facility_class,
        cockpit_rest_positions, cabin_rest_positions
      ),
      home_base:airports!home_base_id (id, iata_code, icao_code, name),
      current_location:airports!current_location_id (id, iata_code, icao_code, name)
    `)
    .order('registration', { ascending: true })

  if (error) {
    console.error('Error fetching aircraft registrations:', error)
    return []
  }
  return (data as unknown as AircraftWithRelations[]) || []
}

export async function getAircraftSeatingConfigs(aircraftId: string): Promise<AircraftSeatingConfig[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('aircraft_seating_configs')
    .select('*')
    .eq('aircraft_id', aircraftId)
    .order('effective_from', { ascending: true })

  if (error) {
    console.error('Error fetching seating configs:', error)
    return []
  }
  return data || []
}

export async function getAllAircraftSeatingConfigs(): Promise<AircraftSeatingConfig[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('aircraft_seating_configs')
    .select('*')
    .order('effective_from', { ascending: true })

  if (error) {
    console.error('Error fetching all seating configs:', error)
    return []
  }
  return data || []
}

// ─── Create ──────────────────────────────────────────────────────────────

export async function createAircraftRegistration(formData: FormData) {
  const supabase = createAdminClient()
  const operatorId = await getCurrentOperatorId()

  const regData = {
    operator_id: operatorId,
    registration: (formData.get('registration') as string)?.toUpperCase().trim(),
    aircraft_type_id: formData.get('aircraft_type_id') as string,
    serial_number: (formData.get('serial_number') as string) || null,
    home_base_id: (formData.get('home_base_id') as string) || null,
    date_of_manufacture: (formData.get('date_of_manufacture') as string) || null,
    date_of_delivery: (formData.get('date_of_delivery') as string) || null,
    status: (formData.get('status') as string) || 'active',
  }

  if (!regData.registration || !regData.aircraft_type_id) {
    return { error: 'Registration and aircraft type are required' }
  }

  const { error } = await supabase.from('aircraft').insert(regData)
  if (error) {
    if (error.code === '23505') return { error: 'An aircraft with this registration already exists' }
    return { error: error.message }
  }

  revalidatePath(REVALIDATE_PATH)
  return { success: true }
}

// ─── Update field ────────────────────────────────────────────────────────

export async function updateAircraftField(
  id: string,
  field: string,
  value: string | number | boolean | null
) {
  if (!(ALLOWED_FIELDS as readonly string[]).includes(field)) {
    return { error: 'Invalid field' }
  }

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('aircraft')
    .update({ [field]: value })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath(REVALIDATE_PATH)
  return { success: true }
}

// ─── Delete ──────────────────────────────────────────────────────────────

export async function deleteAircraftRegistration(id: string) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('aircraft').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath(REVALIDATE_PATH)
  return { success: true }
}

// ─── Upload image ────────────────────────────────────────────────────────

export async function uploadAircraftImage(id: string, formData: FormData) {
  const supabase = createAdminClient()
  const file = formData.get('file') as File
  if (!file) return { error: 'No file provided' }

  const ext = file.name.split('.').pop()
  const path = `aircraft/${id}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('images')
    .upload(path, file, { upsert: true })

  if (uploadError) return { error: uploadError.message }

  const { data: { publicUrl } } = supabase.storage
    .from('images')
    .getPublicUrl(path)

  const { error: updateError } = await supabase
    .from('aircraft')
    .update({ image_url: publicUrl })
    .eq('id', id)

  if (updateError) return { error: updateError.message }

  revalidatePath(REVALIDATE_PATH)
  return { success: true, url: publicUrl }
}

export async function removeAircraftImage(id: string) {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('aircraft')
    .update({ image_url: null })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath(REVALIDATE_PATH)
  return { success: true }
}

// ─── Seating Config CRUD ─────────────────────────────────────────────────

export async function createAircraftSeatingConfig(
  aircraftId: string,
  data: {
    config_name: string
    effective_from: string
    effective_to: string | null
    cabin_config: { class: string; seats: number }[]
    cockpit_rest_facility_class: string | null
    cabin_rest_facility_class: string | null
    cockpit_rest_positions: number | null
    cabin_rest_positions: number | null
    notes: string | null
  }
) {
  const supabase = createAdminClient()
  const total = data.cabin_config.reduce((s, c) => s + c.seats, 0)

  const { error } = await supabase.from('aircraft_seating_configs').insert({
    aircraft_id: aircraftId,
    config_name: data.config_name,
    effective_from: data.effective_from,
    effective_to: data.effective_to || null,
    cabin_config: data.cabin_config,
    total_capacity: total,
    cockpit_rest_facility_class: data.cockpit_rest_facility_class,
    cabin_rest_facility_class: data.cabin_rest_facility_class,
    cockpit_rest_positions: data.cockpit_rest_positions,
    cabin_rest_positions: data.cabin_rest_positions,
    notes: data.notes,
  })

  if (error) return { error: error.message }
  revalidatePath(REVALIDATE_PATH)
  return { success: true }
}

export async function updateAircraftSeatingConfig(
  id: string,
  data: {
    config_name: string
    effective_from: string
    effective_to: string | null
    cabin_config: { class: string; seats: number }[]
    cockpit_rest_facility_class: string | null
    cabin_rest_facility_class: string | null
    cockpit_rest_positions: number | null
    cabin_rest_positions: number | null
    notes: string | null
  }
) {
  const supabase = createAdminClient()
  const total = data.cabin_config.reduce((s, c) => s + c.seats, 0)

  const { error } = await supabase
    .from('aircraft_seating_configs')
    .update({
      config_name: data.config_name,
      effective_from: data.effective_from,
      effective_to: data.effective_to || null,
      cabin_config: data.cabin_config,
      total_capacity: total,
      cockpit_rest_facility_class: data.cockpit_rest_facility_class,
      cabin_rest_facility_class: data.cabin_rest_facility_class,
      cockpit_rest_positions: data.cockpit_rest_positions,
      cabin_rest_positions: data.cabin_rest_positions,
      notes: data.notes,
    })
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath(REVALIDATE_PATH)
  return { success: true }
}

export async function deleteAircraftSeatingConfig(id: string) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('aircraft_seating_configs').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath(REVALIDATE_PATH)
  return { success: true }
}
