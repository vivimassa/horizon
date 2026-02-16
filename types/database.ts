// Database types — aligned with actual Supabase schema

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface CabinEntry {
  class: string
  seats: number
}

export type ModuleName = 'home' | 'network' | 'operations' | 'workforce' | 'reports' | 'admin'
export type UserRole = 'super_admin' | 'admin' | 'ops_controller' | 'crew_controller' | 'roster_planner' | 'crew_member' | 'viewer'
export type UserStatus = 'active' | 'inactive' | 'suspended'

export interface Database {
  public: {
    Tables: {
      operators: {
        Row: {
          id: string
          code: string
          iata_code: string | null
          name: string
          country: string | null
          regulatory_authority: string | null
          fdtl_ruleset: string
          timezone: string
          enabled_modules: Json
          is_active: boolean
          user_id: string | null
          email: string | null
          full_name: string | null
          role: string | null
          status: string | null
          logo_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          code: string
          iata_code?: string | null
          name: string
          country?: string | null
          regulatory_authority?: string | null
          fdtl_ruleset?: string
          timezone?: string
          enabled_modules?: Json
          is_active?: boolean
          user_id?: string | null
          email?: string | null
          full_name?: string | null
          role?: string | null
          status?: string | null
          logo_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          code?: string
          iata_code?: string | null
          name?: string
          country?: string | null
          regulatory_authority?: string | null
          fdtl_ruleset?: string
          timezone?: string
          enabled_modules?: Json
          is_active?: boolean
          user_id?: string | null
          email?: string | null
          full_name?: string | null
          role?: string | null
          status?: string | null
          logo_url?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      module_definitions: {
        Row: {
          id: string
          module_key: string
          module_name: string
          description: string | null
          category: 'core' | 'addon'
          depends_on: string[]
          created_at: string
        }
        Insert: {
          id?: string
          module_key: string
          module_name: string
          description?: string | null
          category: 'core' | 'addon'
          depends_on?: string[]
          created_at?: string
        }
        Update: {
          id?: string
          module_key?: string
          module_name?: string
          description?: string | null
          category?: 'core' | 'addon'
          depends_on?: string[]
          created_at?: string
        }
      }
      airports: {
        Row: {
          id: string
          icao_code: string
          iata_code: string | null
          name: string
          city: string | null
          country: string | null
          country_id: string | null
          timezone: string
          timezone_zone_id: string | null
          utc_offset_hours: number | null
          latitude: number | null
          longitude: number | null
          elevation_ft: number | null
          is_active: boolean
          created_at: string
          longest_runway_length_m: number | null
          longest_runway_width_m: number | null
          runway_identifiers: string | null
          ils_category: string | null
          fire_category: number | null
          slot_classification: string | null
          slot_departure_tolerance_early: number | null
          slot_departure_tolerance_late: number | null
          slot_arrival_tolerance_early: number | null
          slot_arrival_tolerance_late: number | null
          terminals: string | null
          curfew_times: string | null
          crew_reporting_time_minutes: number | null
          crew_debrief_time_minutes: number | null
          is_home_base: boolean
          cannot_be_used_for_diversion: boolean
          weather_limitations: string | null
          notes: string | null
          fuel_available: boolean
          fuel_types: Json | null
          airport_authority: string | null
          operating_hours_open: string | null
          operating_hours_close: string | null
          is_24_hour: boolean
          ground_handling_agents: Json | null
          self_handling_permitted: boolean
          slot_coordinator_contact: string | null
          is_crew_base: boolean
          crew_lounge_available: boolean
          rest_facility_available: boolean
          crew_positioning_reporting_minutes: number | null
          is_etops_alternate: boolean
          etops_diversion_minutes: number | null
          special_notes: string | null
        }
        Insert: {
          id?: string
          icao_code: string
          iata_code?: string | null
          name: string
          city?: string | null
          country?: string | null
          country_id?: string | null
          timezone: string
          timezone_zone_id?: string | null
          utc_offset_hours?: number | null
          latitude?: number | null
          longitude?: number | null
          elevation_ft?: number | null
          is_active?: boolean
          created_at?: string
          longest_runway_length_m?: number | null
          longest_runway_width_m?: number | null
          runway_identifiers?: string | null
          ils_category?: string | null
          fire_category?: number | null
          slot_classification?: string | null
          slot_departure_tolerance_early?: number | null
          slot_departure_tolerance_late?: number | null
          slot_arrival_tolerance_early?: number | null
          slot_arrival_tolerance_late?: number | null
          terminals?: string | null
          curfew_times?: string | null
          crew_reporting_time_minutes?: number | null
          crew_debrief_time_minutes?: number | null
          is_home_base?: boolean
          cannot_be_used_for_diversion?: boolean
          weather_limitations?: string | null
          notes?: string | null
          fuel_available?: boolean
          fuel_types?: Json | null
          airport_authority?: string | null
          operating_hours_open?: string | null
          operating_hours_close?: string | null
          is_24_hour?: boolean
          ground_handling_agents?: Json | null
          self_handling_permitted?: boolean
          slot_coordinator_contact?: string | null
          is_crew_base?: boolean
          crew_lounge_available?: boolean
          rest_facility_available?: boolean
          crew_positioning_reporting_minutes?: number | null
          is_etops_alternate?: boolean
          etops_diversion_minutes?: number | null
          special_notes?: string | null
        }
        Update: {
          id?: string
          icao_code?: string
          iata_code?: string | null
          name?: string
          city?: string | null
          country?: string | null
          country_id?: string | null
          timezone?: string
          timezone_zone_id?: string | null
          utc_offset_hours?: number | null
          latitude?: number | null
          longitude?: number | null
          elevation_ft?: number | null
          is_active?: boolean
          created_at?: string
          longest_runway_length_m?: number | null
          longest_runway_width_m?: number | null
          runway_identifiers?: string | null
          ils_category?: string | null
          fire_category?: number | null
          slot_classification?: string | null
          slot_departure_tolerance_early?: number | null
          slot_departure_tolerance_late?: number | null
          slot_arrival_tolerance_early?: number | null
          slot_arrival_tolerance_late?: number | null
          terminals?: string | null
          curfew_times?: string | null
          crew_reporting_time_minutes?: number | null
          crew_debrief_time_minutes?: number | null
          is_home_base?: boolean
          cannot_be_used_for_diversion?: boolean
          weather_limitations?: string | null
          notes?: string | null
          fuel_available?: boolean
          fuel_types?: Json | null
          airport_authority?: string | null
          operating_hours_open?: string | null
          operating_hours_close?: string | null
          is_24_hour?: boolean
          ground_handling_agents?: Json | null
          self_handling_permitted?: boolean
          slot_coordinator_contact?: string | null
          is_crew_base?: boolean
          crew_lounge_available?: boolean
          rest_facility_available?: boolean
          crew_positioning_reporting_minutes?: number | null
          is_etops_alternate?: boolean
          etops_diversion_minutes?: number | null
          special_notes?: string | null
        }
      }
      countries: {
        Row: {
          id: string
          iso_code_2: string
          iso_code_3: string
          name: string
          official_name: string | null
          region: string | null
          sub_region: string | null
          icao_prefix: string | null
          currency_code: string | null
          currency_name: string | null
          currency_symbol: string | null
          iso_numeric: string | null
          phone_code: string | null
          flag_emoji: string | null
          latitude: number | null
          longitude: number | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          iso_code_2: string
          iso_code_3?: string
          name: string
          official_name?: string | null
          region?: string | null
          sub_region?: string | null
          icao_prefix?: string | null
          currency_code?: string | null
          currency_name?: string | null
          currency_symbol?: string | null
          iso_numeric?: string | null
          phone_code?: string | null
          flag_emoji?: string | null
          latitude?: number | null
          longitude?: number | null
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          iso_code_2?: string
          iso_code_3?: string
          name?: string
          official_name?: string | null
          region?: string | null
          sub_region?: string | null
          icao_prefix?: string | null
          currency_code?: string | null
          currency_name?: string | null
          currency_symbol?: string | null
          iso_numeric?: string | null
          phone_code?: string | null
          flag_emoji?: string | null
          latitude?: number | null
          longitude?: number | null
          is_active?: boolean
          created_at?: string
        }
      }
      timezone_zones: {
        Row: {
          id: string
          country_id: string
          zone_code: string
          zone_name: string
          iana_timezone: string
          utc_offset: string
          dst_observed: boolean
          is_active: boolean
          created_at: string
          notes: string | null
        }
        Insert: {
          id?: string
          country_id: string
          zone_code: string
          zone_name: string
          iana_timezone: string
          utc_offset: string
          dst_observed?: boolean
          is_active?: boolean
          created_at?: string
          notes?: string | null
        }
        Update: {
          id?: string
          country_id?: string
          zone_code?: string
          zone_name?: string
          iana_timezone?: string
          utc_offset?: string
          dst_observed?: boolean
          is_active?: boolean
          created_at?: string
          notes?: string | null
        }
      }
      aircraft_types: {
        Row: {
          id: string
          operator_id: string
          icao_type: string
          iata_type: string | null
          name: string
          family: string | null
          category: string
          pax_capacity: number | null
          cockpit_crew_required: number
          cabin_crew_required: number | null
          default_tat_minutes: number | null
          default_cabin_config: Json | null
          is_active: boolean
          created_at: string
          updated_at: string | null
          image_url: string | null
          iata_type_code: string | null
          manufacturer: string | null
          mtow_kg: number | null
          mlw_kg: number | null
          mzfw_kg: number | null
          oew_kg: number | null
          max_fuel_capacity_kg: number | null
          fuel_unit: string | null
          fuel_burn_rate_kg_per_hour: number | null
          max_range_nm: number | null
          cruising_speed_kts: number | null
          cruising_mach: number | null
          min_runway_length_m: number | null
          min_runway_width_m: number | null
          fire_category: number | null
          wake_turbulence_category: string | null
          etops_capable: boolean | null
          etops_max_minutes: number | null
          noise_category: string | null
          emissions_class: string | null
          tat_dom_dom_minutes: number | null
          tat_dom_int_minutes: number | null
          tat_int_dom_minutes: number | null
          tat_int_int_minutes: number | null
          max_cargo_weight_kg: number | null
          cargo_positions: number | null
          uld_types_accepted: Json | null
          bulk_hold_capacity_kg: number | null
          cockpit_rest_facility_class: string | null
          cabin_rest_facility_class: string | null
          cockpit_rest_positions: number | null
          cabin_rest_positions: number | null
          weather_limitations: Json | null
          ils_category_required: string | null
          autoland_capable: boolean | null
          notes: string | null
        }
        Insert: {
          id?: string
          operator_id: string
          icao_type: string
          iata_type?: string | null
          name: string
          family?: string | null
          category?: string
          pax_capacity?: number | null
          cockpit_crew_required?: number
          cabin_crew_required?: number | null
          default_tat_minutes?: number | null
          default_cabin_config?: Json | null
          is_active?: boolean
          created_at?: string
          updated_at?: string | null
          image_url?: string | null
          iata_type_code?: string | null
          manufacturer?: string | null
          mtow_kg?: number | null
          mlw_kg?: number | null
          mzfw_kg?: number | null
          oew_kg?: number | null
          max_fuel_capacity_kg?: number | null
          fuel_unit?: string | null
          fuel_burn_rate_kg_per_hour?: number | null
          max_range_nm?: number | null
          cruising_speed_kts?: number | null
          cruising_mach?: number | null
          min_runway_length_m?: number | null
          min_runway_width_m?: number | null
          fire_category?: number | null
          wake_turbulence_category?: string | null
          etops_capable?: boolean | null
          etops_max_minutes?: number | null
          noise_category?: string | null
          emissions_class?: string | null
          tat_dom_dom_minutes?: number | null
          tat_dom_int_minutes?: number | null
          tat_int_dom_minutes?: number | null
          tat_int_int_minutes?: number | null
          max_cargo_weight_kg?: number | null
          cargo_positions?: number | null
          uld_types_accepted?: Json | null
          bulk_hold_capacity_kg?: number | null
          cockpit_rest_facility_class?: string | null
          cabin_rest_facility_class?: string | null
          cockpit_rest_positions?: number | null
          cabin_rest_positions?: number | null
          weather_limitations?: Json | null
          ils_category_required?: string | null
          autoland_capable?: boolean | null
          notes?: string | null
        }
        Update: {
          id?: string
          operator_id?: string
          icao_type?: string
          iata_type?: string | null
          name?: string
          family?: string | null
          category?: string
          pax_capacity?: number | null
          cockpit_crew_required?: number
          cabin_crew_required?: number | null
          default_tat_minutes?: number | null
          default_cabin_config?: Json | null
          is_active?: boolean
          created_at?: string
          updated_at?: string | null
          image_url?: string | null
          iata_type_code?: string | null
          manufacturer?: string | null
          mtow_kg?: number | null
          mlw_kg?: number | null
          mzfw_kg?: number | null
          oew_kg?: number | null
          max_fuel_capacity_kg?: number | null
          fuel_unit?: string | null
          fuel_burn_rate_kg_per_hour?: number | null
          max_range_nm?: number | null
          cruising_speed_kts?: number | null
          cruising_mach?: number | null
          min_runway_length_m?: number | null
          min_runway_width_m?: number | null
          fire_category?: number | null
          wake_turbulence_category?: string | null
          etops_capable?: boolean | null
          etops_max_minutes?: number | null
          noise_category?: string | null
          emissions_class?: string | null
          tat_dom_dom_minutes?: number | null
          tat_dom_int_minutes?: number | null
          tat_int_dom_minutes?: number | null
          tat_int_int_minutes?: number | null
          max_cargo_weight_kg?: number | null
          cargo_positions?: number | null
          uld_types_accepted?: Json | null
          bulk_hold_capacity_kg?: number | null
          cockpit_rest_facility_class?: string | null
          cabin_rest_facility_class?: string | null
          cockpit_rest_positions?: number | null
          cabin_rest_positions?: number | null
          weather_limitations?: Json | null
          ils_category_required?: string | null
          autoland_capable?: boolean | null
          notes?: string | null
        }
      }
      aircraft_type_seating_configs: {
        Row: {
          id: string
          aircraft_type_id: string | null
          config_name: string
          cabin_config: Json
          is_default: boolean | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          aircraft_type_id?: string | null
          config_name: string
          cabin_config: Json
          is_default?: boolean | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          aircraft_type_id?: string | null
          config_name?: string
          cabin_config?: Json
          is_default?: boolean | null
          notes?: string | null
          created_at?: string
        }
      }
      aircraft: {
        Row: {
          id: string
          operator_id: string
          registration: string
          aircraft_type_id: string
          status: string
          home_base_id: string | null
          seating_config: Json | null
          is_active: boolean
          created_at: string
          updated_at: string
          serial_number: string | null
          sub_operator: string | null
          date_of_manufacture: string | null
          date_of_delivery: string | null
          lease_expiry_date: string | null
          image_url: string | null
          notes: string | null
          current_location_id: string | null
          current_location_updated_at: string | null
          flight_hours_total: number | null
          cycles_total: number | null
          next_maintenance_due: string | null
          last_maintenance_date: string | null
          last_maintenance_description: string | null
          aircraft_version: string | null
          mtow_kg_override: number | null
          max_range_nm_override: number | null
          cockpit_rest_facility_class_override: string | null
          cabin_rest_facility_class_override: string | null
          cockpit_rest_positions_override: number | null
          cabin_rest_positions_override: number | null
        }
        Insert: {
          id?: string
          operator_id: string
          registration: string
          aircraft_type_id: string
          status?: string
          home_base_id?: string | null
          seating_config?: Json | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
          serial_number?: string | null
          sub_operator?: string | null
          date_of_manufacture?: string | null
          date_of_delivery?: string | null
          lease_expiry_date?: string | null
          image_url?: string | null
          notes?: string | null
          current_location_id?: string | null
          current_location_updated_at?: string | null
          flight_hours_total?: number | null
          cycles_total?: number | null
          next_maintenance_due?: string | null
          last_maintenance_date?: string | null
          last_maintenance_description?: string | null
          aircraft_version?: string | null
          mtow_kg_override?: number | null
          max_range_nm_override?: number | null
          cockpit_rest_facility_class_override?: string | null
          cabin_rest_facility_class_override?: string | null
          cockpit_rest_positions_override?: number | null
          cabin_rest_positions_override?: number | null
        }
        Update: {
          id?: string
          operator_id?: string
          registration?: string
          aircraft_type_id?: string
          status?: string
          home_base_id?: string | null
          seating_config?: Json | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
          serial_number?: string | null
          sub_operator?: string | null
          date_of_manufacture?: string | null
          date_of_delivery?: string | null
          lease_expiry_date?: string | null
          image_url?: string | null
          notes?: string | null
          current_location_id?: string | null
          current_location_updated_at?: string | null
          flight_hours_total?: number | null
          cycles_total?: number | null
          next_maintenance_due?: string | null
          last_maintenance_date?: string | null
          last_maintenance_description?: string | null
          aircraft_version?: string | null
          mtow_kg_override?: number | null
          max_range_nm_override?: number | null
          cockpit_rest_facility_class_override?: string | null
          cabin_rest_facility_class_override?: string | null
          cockpit_rest_positions_override?: number | null
          cabin_rest_positions_override?: number | null
        }
      }
      aircraft_seating_configs: {
        Row: {
          id: string
          aircraft_id: string
          config_name: string
          effective_from: string
          effective_to: string | null
          cabin_config: Json
          total_capacity: number
          cockpit_rest_facility_class: string | null
          cabin_rest_facility_class: string | null
          cockpit_rest_positions: number | null
          cabin_rest_positions: number | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          aircraft_id: string
          config_name: string
          effective_from: string
          effective_to?: string | null
          cabin_config: Json
          total_capacity?: number
          cockpit_rest_facility_class?: string | null
          cabin_rest_facility_class?: string | null
          cockpit_rest_positions?: number | null
          cabin_rest_positions?: number | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          aircraft_id?: string
          config_name?: string
          effective_from?: string
          effective_to?: string | null
          cabin_config?: Json
          total_capacity?: number
          cockpit_rest_facility_class?: string | null
          cabin_rest_facility_class?: string | null
          cockpit_rest_positions?: number | null
          cabin_rest_positions?: number | null
          notes?: string | null
          created_at?: string
        }
      }
      airport_tat_rules: {
        Row: {
          id: string
          airport_id: string
          aircraft_type_id: string
          tat_minutes: number
          tat_dom_dom_minutes: number | null
          tat_dom_int_minutes: number | null
          tat_int_dom_minutes: number | null
          tat_int_int_minutes: number | null
          notes: string | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          airport_id: string
          aircraft_type_id: string
          tat_minutes: number
          tat_dom_dom_minutes?: number | null
          tat_dom_int_minutes?: number | null
          tat_int_dom_minutes?: number | null
          tat_int_int_minutes?: number | null
          notes?: string | null
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          airport_id?: string
          aircraft_type_id?: string
          tat_minutes?: number
          tat_dom_dom_minutes?: number | null
          tat_dom_int_minutes?: number | null
          tat_int_dom_minutes?: number | null
          tat_int_int_minutes?: number | null
          notes?: string | null
          is_active?: boolean
          created_at?: string
        }
      }
      airport_runways: {
        Row: {
          id: string
          airport_id: string
          identifier: string
          length_m: number | null
          width_m: number | null
          surface: string | null
          ils_category: string | null
          lighting: boolean
          status: string
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          airport_id: string
          identifier: string
          length_m?: number | null
          width_m?: number | null
          surface?: string | null
          ils_category?: string | null
          lighting?: boolean
          status?: string
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          airport_id?: string
          identifier?: string
          length_m?: number | null
          width_m?: number | null
          surface?: string | null
          ils_category?: string | null
          lighting?: boolean
          status?: string
          notes?: string | null
          created_at?: string
        }
      }
      airport_terminals: {
        Row: {
          id: string
          airport_id: string
          code: string
          name: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          airport_id: string
          code: string
          name?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          airport_id?: string
          code?: string
          name?: string | null
          notes?: string | null
          created_at?: string
        }
      }
      airport_curfews: {
        Row: {
          id: string
          airport_id: string
          days: string
          no_ops_from: string
          no_ops_until: string
          exception: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          airport_id: string
          days?: string
          no_ops_from: string
          no_ops_until: string
          exception?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          airport_id?: string
          days?: string
          no_ops_from?: string
          no_ops_until?: string
          exception?: string | null
          notes?: string | null
          created_at?: string
        }
      }
      airport_frequencies: {
        Row: {
          id: string
          airport_id: string
          type: string
          frequency: string
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          airport_id: string
          type: string
          frequency: string
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          airport_id?: string
          type?: string
          frequency?: string
          notes?: string | null
          created_at?: string
        }
      }
      airport_weather_limits: {
        Row: {
          id: string
          airport_id: string
          limitation_type: string
          warning_value: number | null
          alert_value: number | null
          unit: string
          created_at: string
        }
        Insert: {
          id?: string
          airport_id: string
          limitation_type: string
          warning_value?: number | null
          alert_value?: number | null
          unit: string
          created_at?: string
        }
        Update: {
          id?: string
          airport_id?: string
          limitation_type?: string
          warning_value?: number | null
          alert_value?: number | null
          unit?: string
          created_at?: string
        }
      }
      flight_service_types: {
        Row: {
          id: string
          operator_id: string
          code: string
          name: string
          description: string | null
          color: string | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          operator_id: string
          code: string
          name: string
          description?: string | null
          color?: string | null
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          operator_id?: string
          code?: string
          name?: string
          description?: string | null
          color?: string | null
          is_active?: boolean
          created_at?: string
        }
      }
      delay_codes: {
        Row: {
          id: string
          operator_id: string
          code: string
          category: string
          name: string
          description: string | null
          is_active: boolean
          is_iata_standard: boolean
          created_at: string
        }
        Insert: {
          id?: string
          operator_id: string
          code: string
          category: string
          name: string
          description?: string | null
          is_active?: boolean
          is_iata_standard?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          operator_id?: string
          code?: string
          category?: string
          name?: string
          description?: string | null
          is_active?: boolean
          is_iata_standard?: boolean
          created_at?: string
        }
      }
      cabin_classes: {
        Row: {
          id: string
          operator_id: string | null
          code: string
          name: string
          color: string | null
          sort_order: number | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          operator_id?: string | null
          code: string
          name: string
          color?: string | null
          sort_order?: number | null
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          operator_id?: string | null
          code?: string
          name?: string
          color?: string | null
          sort_order?: number | null
          is_active?: boolean
          created_at?: string
        }
      }
      airlines: {
        Row: {
          id: string
          icao_code: string
          iata_code: string | null
          name: string
          country: string | null
          country_id: string | null
          alliance: string | null
          callsign: string | null
          operator_id: string | null
          is_own_airline: boolean
          is_active: boolean
          notes: string | null
          created_at: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          icao_code: string
          iata_code?: string | null
          name: string
          country?: string | null
          country_id?: string | null
          alliance?: string | null
          callsign?: string | null
          operator_id?: string | null
          is_own_airline?: boolean
          is_active?: boolean
          notes?: string | null
          created_at?: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          icao_code?: string
          iata_code?: string | null
          name?: string
          country?: string | null
          country_id?: string | null
          alliance?: string | null
          callsign?: string | null
          operator_id?: string | null
          is_own_airline?: boolean
          is_active?: boolean
          notes?: string | null
          created_at?: string
          updated_at?: string | null
        }
      }
      city_pairs: {
        Row: {
          id: string
          departure_airport_id: string | null
          arrival_airport_id: string | null
          departure_airport: string | null
          arrival_airport: string | null
          standard_block_minutes: number | null
          distance_nm: number | null
          distance_km: number | null
          great_circle_distance_nm: number | null
          block_time: number | null
          distance: number | null
          route_type: string
          is_etops: boolean
          etops_required: boolean
          etops_diversion_time_minutes: number | null
          is_overwater: boolean
          requires_special_qualification: boolean
          status: string
          notes: string | null
          is_active: boolean
          created_at: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          departure_airport_id?: string | null
          arrival_airport_id?: string | null
          departure_airport?: string | null
          arrival_airport?: string | null
          standard_block_minutes?: number | null
          distance_nm?: number | null
          distance_km?: number | null
          great_circle_distance_nm?: number | null
          block_time?: number | null
          distance?: number | null
          route_type: string
          is_etops?: boolean
          etops_required?: boolean
          etops_diversion_time_minutes?: number | null
          is_overwater?: boolean
          requires_special_qualification?: boolean
          status?: string
          notes?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          departure_airport_id?: string | null
          arrival_airport_id?: string | null
          departure_airport?: string | null
          arrival_airport?: string | null
          standard_block_minutes?: number | null
          distance_nm?: number | null
          distance_km?: number | null
          great_circle_distance_nm?: number | null
          block_time?: number | null
          distance?: number | null
          route_type?: string
          is_etops?: boolean
          etops_required?: boolean
          etops_diversion_time_minutes?: number | null
          is_overwater?: boolean
          requires_special_qualification?: boolean
          status?: string
          notes?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string | null
        }
      }
      city_pair_block_hours: {
        Row: {
          id: string
          city_pair_id: string
          aircraft_type_id: string
          season_type: string
          month_applicable: number | null
          direction1_block_minutes: number
          direction2_block_minutes: number
          direction1_flight_minutes: number | null
          direction2_flight_minutes: number | null
          direction1_fuel_kg: number | null
          direction2_fuel_kg: number | null
          direction1_avg_payload_kg: number | null
          direction2_avg_payload_kg: number | null
          cruise_altitude_ft: number | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          city_pair_id: string
          aircraft_type_id: string
          season_type: string
          month_applicable?: number | null
          direction1_block_minutes: number
          direction2_block_minutes: number
          direction1_flight_minutes?: number | null
          direction2_flight_minutes?: number | null
          direction1_fuel_kg?: number | null
          direction2_fuel_kg?: number | null
          direction1_avg_payload_kg?: number | null
          direction2_avg_payload_kg?: number | null
          cruise_altitude_ft?: number | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          city_pair_id?: string
          aircraft_type_id?: string
          season_type?: string
          month_applicable?: number | null
          direction1_block_minutes?: number
          direction2_block_minutes?: number
          direction1_flight_minutes?: number | null
          direction2_flight_minutes?: number | null
          direction1_fuel_kg?: number | null
          direction2_fuel_kg?: number | null
          direction1_avg_payload_kg?: number | null
          direction2_avg_payload_kg?: number | null
          cruise_altitude_ft?: number | null
          notes?: string | null
          created_at?: string
        }
      }
      schedule_seasons: {
        Row: {
          id: string
          operator_id: string
          code: string
          name: string
          start_date: string
          end_date: string
          status: string
          created_at: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          operator_id: string
          code: string
          name: string
          start_date: string
          end_date: string
          status?: string
          created_at?: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          operator_id?: string
          code?: string
          name?: string
          start_date?: string
          end_date?: string
          status?: string
          created_at?: string
          updated_at?: string | null
        }
      }
      service_types: {
        Row: {
          id: string
          code: string
          name: string
          description: string | null
          color: string
          created_at: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          code: string
          name: string
          description?: string | null
          color?: string
          created_at?: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          code?: string
          name?: string
          description?: string | null
          color?: string
          created_at?: string
          updated_at?: string | null
        }
      }
      cabin_configurations: {
        Row: {
          id: string
          aircraft_type: string
          name: string
          cabins: CabinEntry[]
          total_seats: number
          created_at: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          aircraft_type: string
          name: string
          cabins?: CabinEntry[]
          total_seats: number
          created_at?: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          aircraft_type?: string
          name?: string
          cabins?: CabinEntry[]
          total_seats?: number
          created_at?: string
          updated_at?: string | null
        }
      }
      flight_numbers: {
        Row: {
          id: string
          operator_id: string
          season_id: string | null
          flight_number: string
          departure_iata: string | null
          arrival_iata: string | null
          std: string
          sta: string
          block_minutes: number
          days_of_week: string
          aircraft_type_id: string | null
          service_type: string
          effective_from: string | null
          effective_until: string | null
          arrival_day_offset: number
          created_at: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          operator_id: string
          season_id?: string | null
          flight_number: string
          departure_iata?: string | null
          arrival_iata?: string | null
          std?: string
          sta?: string
          block_minutes?: number
          days_of_week?: string
          aircraft_type_id?: string | null
          service_type?: string
          effective_from?: string | null
          effective_until?: string | null
          arrival_day_offset?: number
          created_at?: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          operator_id?: string
          season_id?: string | null
          flight_number?: string
          departure_iata?: string | null
          arrival_iata?: string | null
          std?: string
          sta?: string
          block_minutes?: number
          days_of_week?: string
          aircraft_type_id?: string | null
          service_type?: string
          effective_from?: string | null
          effective_until?: string | null
          arrival_day_offset?: number
          created_at?: string
          updated_at?: string | null
        }
      }
      flights: {
        Row: {
          id: string
          operator_id: string
          flight_number_id: string | null
          flight_number: string | null
          flight_date: string
          departure_iata: string | null
          arrival_iata: string | null
          std_utc: string | null
          sta_utc: string | null
          std_local: string
          sta_local: string
          block_minutes: number
          aircraft_type_id: string | null
          aircraft_id: string | null
          service_type: string
          status: string
          arrival_day_offset: number
          created_at: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          operator_id: string
          flight_number_id?: string | null
          flight_number?: string | null
          flight_date: string
          departure_iata?: string | null
          arrival_iata?: string | null
          std_utc?: string | null
          sta_utc?: string | null
          std_local?: string
          sta_local?: string
          block_minutes?: number
          aircraft_type_id?: string | null
          aircraft_id?: string | null
          service_type?: string
          status?: string
          arrival_day_offset?: number
          created_at?: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          operator_id?: string
          flight_number_id?: string | null
          flight_number?: string | null
          flight_date?: string
          departure_iata?: string | null
          arrival_iata?: string | null
          std_utc?: string | null
          sta_utc?: string | null
          std_local?: string
          sta_local?: string
          block_minutes?: number
          aircraft_type_id?: string | null
          aircraft_id?: string | null
          service_type?: string
          status?: string
          arrival_day_offset?: number
          created_at?: string
          updated_at?: string | null
        }
      }
      ssim_imports: {
        Row: {
          id: string
          operator_id: string
          season_id: string | null
          filename: string | null
          direction: string
          total_records: number
          new_records: number
          updated_records: number
          unchanged_records: number
          error_records: number
          errors: Json
          created_at: string
        }
        Insert: {
          id?: string
          operator_id: string
          season_id?: string | null
          filename?: string | null
          direction?: string
          total_records?: number
          new_records?: number
          updated_records?: number
          unchanged_records?: number
          error_records?: number
          errors?: Json
          created_at?: string
        }
        Update: {
          id?: string
          operator_id?: string
          season_id?: string | null
          filename?: string | null
          direction?: string
          total_records?: number
          new_records?: number
          updated_records?: number
          unchanged_records?: number
          error_records?: number
          errors?: Json
          created_at?: string
        }
      }
      message_log: {
        Row: {
          id: string
          operator_id: string
          message_type: string
          action_code: string | null
          direction: string
          flight_number: string | null
          flight_date: string | null
          status: string
          summary: string | null
          raw_message: string | null
          changes: Json | null
          reject_reason: string | null
          created_at: string
        }
        Insert: {
          id?: string
          operator_id: string
          message_type: string
          action_code?: string | null
          direction: string
          flight_number?: string | null
          flight_date?: string | null
          status?: string
          summary?: string | null
          raw_message?: string | null
          changes?: Json | null
          reject_reason?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          operator_id?: string
          message_type?: string
          action_code?: string | null
          direction?: string
          flight_number?: string | null
          flight_date?: string | null
          status?: string
          summary?: string | null
          raw_message?: string | null
          changes?: Json | null
          reject_reason?: string | null
          created_at?: string
        }
      }
    }
    Views: {}
    Functions: {}
    Enums: {}
  }
}

export type Operator = Database['public']['Tables']['operators']['Row']
export type Airport = Database['public']['Tables']['airports']['Row']
export type Country = Database['public']['Tables']['countries']['Row']
export type AircraftType = Database['public']['Tables']['aircraft_types']['Row']
export type AircraftTypeSeatingConfig = Database['public']['Tables']['aircraft_type_seating_configs']['Row']
export type Airline = Database['public']['Tables']['airlines']['Row']
export type CityPair = Database['public']['Tables']['city_pairs']['Row']
export type CityPairBlockHours = Database['public']['Tables']['city_pair_block_hours']['Row']
export type ModuleDefinition = Database['public']['Tables']['module_definitions']['Row']
export type ScheduleSeason = Database['public']['Tables']['schedule_seasons']['Row']
export type ServiceType = Database['public']['Tables']['service_types']['Row']
export type CabinConfiguration = Database['public']['Tables']['cabin_configurations']['Row']
export type Aircraft = Database['public']['Tables']['aircraft']['Row']
export type AircraftSeatingConfig = Database['public']['Tables']['aircraft_seating_configs']['Row']
export type AirportTatRule = Database['public']['Tables']['airport_tat_rules']['Row']
export type AirportRunway = Database['public']['Tables']['airport_runways']['Row']
export type AirportTerminal = Database['public']['Tables']['airport_terminals']['Row']
export type AirportCurfew = Database['public']['Tables']['airport_curfews']['Row']
export type AirportFrequency = Database['public']['Tables']['airport_frequencies']['Row']
export type AirportWeatherLimit = Database['public']['Tables']['airport_weather_limits']['Row']
export type FlightServiceType = Database['public']['Tables']['flight_service_types']['Row']
export type DelayCode = Database['public']['Tables']['delay_codes']['Row']
export type CabinClass = Database['public']['Tables']['cabin_classes']['Row']
// FlightNumber is now a virtual type mapped from scheduled_flights
export interface FlightNumber {
  id: string
  operator_id: string
  season_id: string | null
  flight_number: string
  suffix: string | null
  departure_airport_id: string | null
  arrival_airport_id: string | null
  departure_iata: string | null
  arrival_iata: string | null
  std_local: string
  sta_local: string
  std: string
  sta: string
  std_utc: string | null
  sta_utc: string | null
  block_minutes: number
  arrival_day_offset: number
  days_of_operation: string
  days_of_week: string
  aircraft_type_id: string | null
  aircraft_type_icao: string | null
  connecting_flight: string | null
  status: string
  cockpit_crew_required: number | null
  cabin_crew_required: number | null
  service_type: string
  is_etops: boolean
  is_overwater: boolean
  is_active: boolean
  effective_from: string | null
  effective_until: string | null
  created_at: string
  updated_at: string | null
  source: string | null
}
export type Flight = Database['public']['Tables']['flights']['Row']
export type SsimImport = Database['public']['Tables']['ssim_imports']['Row']
export type MessageLog = Database['public']['Tables']['message_log']['Row']
export type TimezoneZone = Database['public']['Tables']['timezone_zones']['Row']

export interface UserPreferences {
  id: string
  user_id: string
  theme: 'light' | 'dark' | 'system'
  dock_position: 'bottom' | 'left' | 'top'
  created_at: string
  updated_at: string
}
