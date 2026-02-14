// Database types will be generated here from Supabase
// Run: npx supabase gen types typescript --project-id YOUR_PROJECT_ID > types/database.ts

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type ModuleName = 'home' | 'network' | 'operations' | 'workforce' | 'reports' | 'admin'
export type UserRole = 'super_admin' | 'admin' | 'ops_controller' | 'crew_controller' | 'roster_planner' | 'crew_member' | 'viewer'
export type UserStatus = 'active' | 'inactive' | 'suspended'

export interface Database {
  public: {
    Tables: {
      operators: {
        Row: {
          id: string
          user_id: string
          email: string
          full_name: string | null
          role: UserRole
          status: UserStatus
          enabled_modules: ModuleName[]
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          email: string
          full_name?: string | null
          role?: UserRole
          status?: UserStatus
          enabled_modules?: ModuleName[]
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          email?: string
          full_name?: string | null
          role?: UserRole
          status?: UserStatus
          enabled_modules?: ModuleName[]
          created_at?: string
          updated_at?: string
        }
      }
      // operator_profile table doesn't exist - using operators table instead
      // See app/actions/operator-profile.ts for the OperatorProfile type
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
          airport_name: string
          city: string
          country: string
          timezone: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          icao_code: string
          iata_code?: string | null
          airport_name: string
          city: string
          country: string
          timezone: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          icao_code?: string
          iata_code?: string | null
          airport_name?: string
          city?: string
          country?: string
          timezone?: string
          created_at?: string
          updated_at?: string
        }
      }
      countries: {
        Row: {
          id: string
          iso_code: string
          name: string
          region: string
          currency: string
          icao_prefix: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          iso_code: string
          name: string
          region: string
          currency: string
          icao_prefix: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          iso_code?: string
          name?: string
          region?: string
          currency?: string
          icao_prefix?: string
          created_at?: string
          updated_at?: string
        }
      }
      aircraft_types: {
        Row: {
          id: string
          icao_type: string
          iata_type: string | null
          name: string
          family: string
          category: 'narrow-body' | 'wide-body' | 'regional' | 'turboprop' | 'freighter' | 'business'
          pax_capacity: number
          cockpit_crew: number
          cabin_crew: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          icao_type: string
          iata_type?: string | null
          name: string
          family: string
          category: 'narrow-body' | 'wide-body' | 'regional' | 'turboprop' | 'freighter' | 'business'
          pax_capacity: number
          cockpit_crew: number
          cabin_crew: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          icao_type?: string
          iata_type?: string | null
          name?: string
          family?: string
          category?: 'narrow-body' | 'wide-body' | 'regional' | 'turboprop' | 'freighter' | 'business'
          pax_capacity?: number
          cockpit_crew?: number
          cabin_crew?: number
          created_at?: string
          updated_at?: string
        }
      }
      airlines: {
        Row: {
          id: string
          icao_code: string
          iata_code: string | null
          name: string
          country: string
          alliance: 'Star Alliance' | 'Oneworld' | 'SkyTeam' | 'None' | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          icao_code: string
          iata_code?: string | null
          name: string
          country: string
          alliance?: 'Star Alliance' | 'Oneworld' | 'SkyTeam' | 'None' | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          icao_code?: string
          iata_code?: string | null
          name?: string
          country?: string
          alliance?: 'Star Alliance' | 'Oneworld' | 'SkyTeam' | 'None' | null
          created_at?: string
          updated_at?: string
        }
      }
      city_pairs: {
        Row: {
          id: string
          departure_airport: string
          arrival_airport: string
          block_time: number
          distance: number
          route_type: 'domestic' | 'regional' | 'international' | 'long-haul' | 'ultra-long-haul'
          etops_required: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          departure_airport: string
          arrival_airport: string
          block_time: number
          distance: number
          route_type: 'domestic' | 'regional' | 'international' | 'long-haul' | 'ultra-long-haul'
          etops_required?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          departure_airport?: string
          arrival_airport?: string
          block_time?: number
          distance?: number
          route_type?: 'domestic' | 'regional' | 'international' | 'long-haul' | 'ultra-long-haul'
          etops_required?: boolean
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      // Your view types will be defined here
    }
    Functions: {
      // Your function types will be defined here
    }
    Enums: {
      // Your enum types will be defined here
    }
  }
}

export type Operator = Database['public']['Tables']['operators']['Row']
export type Airport = Database['public']['Tables']['airports']['Row']
export type Country = Database['public']['Tables']['countries']['Row']
export type AircraftType = Database['public']['Tables']['aircraft_types']['Row']
export type Airline = Database['public']['Tables']['airlines']['Row']
export type CityPair = Database['public']['Tables']['city_pairs']['Row']
// OperatorProfile is now defined in app/actions/operator-profile.ts (uses operators table)
export type ModuleDefinition = Database['public']['Tables']['module_definitions']['Row']
