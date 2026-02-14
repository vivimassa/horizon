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
          timezone: string
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          icao_code: string
          iata_code?: string | null
          name: string
          city?: string | null
          country?: string | null
          timezone: string
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          icao_code?: string
          iata_code?: string | null
          name?: string
          city?: string | null
          country?: string | null
          timezone?: string
          is_active?: boolean
          created_at?: string
        }
      }
      countries: {
        Row: {
          id: string
          iso_code_2: string
          iso_code_3: string
          name: string
          region: string | null
          icao_prefix: string | null
          currency_code: string | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          iso_code_2: string
          iso_code_3?: string
          name: string
          region?: string | null
          icao_prefix?: string | null
          currency_code?: string | null
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          iso_code_2?: string
          iso_code_3?: string
          name?: string
          region?: string | null
          icao_prefix?: string | null
          currency_code?: string | null
          is_active?: boolean
          created_at?: string
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
        }
      }
      airport_tat_rules: {
        Row: {
          id: string
          airport_id: string
          aircraft_type_id: string
          tat_minutes: number
          notes: string | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          airport_id: string
          aircraft_type_id: string
          tat_minutes: number
          notes?: string | null
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          airport_id?: string
          aircraft_type_id?: string
          tat_minutes?: number
          notes?: string | null
          is_active?: boolean
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
          alliance: string | null
          is_active: boolean
          created_at: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          icao_code: string
          iata_code?: string | null
          name: string
          country?: string | null
          alliance?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          icao_code?: string
          iata_code?: string | null
          name?: string
          country?: string | null
          alliance?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string | null
        }
      }
      city_pairs: {
        Row: {
          id: string
          departure_airport: string | null
          arrival_airport: string | null
          block_time: number | null
          distance: number | null
          route_type: string
          etops_required: boolean
          is_active: boolean
          created_at: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          departure_airport?: string | null
          arrival_airport?: string | null
          block_time?: number | null
          distance?: number | null
          route_type: string
          etops_required?: boolean
          is_active?: boolean
          created_at?: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          departure_airport?: string | null
          arrival_airport?: string | null
          block_time?: number | null
          distance?: number | null
          route_type?: string
          etops_required?: boolean
          is_active?: boolean
          created_at?: string
          updated_at?: string | null
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
export type Airline = Database['public']['Tables']['airlines']['Row']
export type CityPair = Database['public']['Tables']['city_pairs']['Row']
export type ModuleDefinition = Database['public']['Tables']['module_definitions']['Row']
export type ScheduleSeason = Database['public']['Tables']['schedule_seasons']['Row']
export type ServiceType = Database['public']['Tables']['service_types']['Row']
export type CabinConfiguration = Database['public']['Tables']['cabin_configurations']['Row']
export type Aircraft = Database['public']['Tables']['aircraft']['Row']
export type AirportTatRule = Database['public']['Tables']['airport_tat_rules']['Row']
export type FlightServiceType = Database['public']['Tables']['flight_service_types']['Row']
export type DelayCode = Database['public']['Tables']['delay_codes']['Row']
export type FlightNumber = Database['public']['Tables']['flight_numbers']['Row']
export type Flight = Database['public']['Tables']['flights']['Row']
export type SsimImport = Database['public']['Tables']['ssim_imports']['Row']
export type MessageLog = Database['public']['Tables']['message_log']['Row']

export interface UserPreferences {
  id: string
  user_id: string
  theme: 'light' | 'dark' | 'system'
  dock_position: 'bottom' | 'left' | 'top'
  created_at: string
  updated_at: string
}
