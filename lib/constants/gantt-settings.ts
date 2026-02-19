export interface GanttSettingsData {
  // General
  assignmentMethod: 'minimize' | 'balance'
  timeDisplay: 'dual' | 'utc' | 'local'
  baseTimezoneOffset: number
  baseStation: string
  barLabels: { sector: boolean; times: boolean; blockTime: boolean }
  fleetSortOrder: 'type_reg' | 'reg_only' | 'type_util'

  // Display
  display: {
    histogram: boolean
    eodBadges: boolean
    tatLabels: boolean
    conflictIndicators: boolean
    workspaceIcons: boolean
    cancelledFlights: boolean
    weekendHighlights: boolean
    groupSeparators: boolean
  }

  // Colors
  colorMode: 'assignment' | 'ac_type' | 'service_type' | 'destination_type'
  colorAssignment: { unassigned: string; assigned: string }
  colorAcType: Record<string, string>
  colorServiceType: Record<string, string>
  colorDestType: { domestic: string; international: string }

  // Tooltip
  tooltip: {
    flightNumber: boolean
    stations: boolean
    times: boolean
    blockTime: boolean
    aircraft: boolean
    cabin: boolean
    tat: boolean
  }

  // Optimizer
  allowFamilySub: boolean

  // AC type display order (empty = alphabetical)
  acTypeOrder: string[]

  // Existing
  tatOverrides: Record<string, { dd?: number; di?: number; id?: number; ii?: number }>
  utilizationTargets: Record<string, number>

  // Deprecated (migration only)
  barLabelFormat?: 'full' | 'number_sector' | 'number' | 'sector'
  barColors?: { unassigned: string; assigned: string }
}

export const DEFAULT_GANTT_SETTINGS: GanttSettingsData = {
  assignmentMethod: 'minimize',
  timeDisplay: 'dual',
  baseTimezoneOffset: 7,
  baseStation: 'SGN',
  barLabels: { sector: true, times: true, blockTime: false },
  fleetSortOrder: 'type_reg',

  display: {
    histogram: true,
    eodBadges: true,
    tatLabels: true,
    conflictIndicators: true,
    workspaceIcons: true,
    cancelledFlights: false,
    weekendHighlights: true,
    groupSeparators: true,
  },

  colorMode: 'assignment',
  colorAssignment: { unassigned: '#DBEAFE', assigned: '#3B82F6' },
  colorAcType: {},
  colorServiceType: {},
  colorDestType: { domestic: '#3B82F6', international: '#8B5CF6' },

  tooltip: {
    flightNumber: true,
    stations: true,
    times: true,
    blockTime: true,
    aircraft: true,
    cabin: true,
    tat: true,
  },

  allowFamilySub: false,

  acTypeOrder: [],

  tatOverrides: {},
  utilizationTargets: {},
}

/** Vivid color palette for auto-assigning AC type colors. */
export const AC_TYPE_COLOR_PALETTE = [
  '#3B82F6', // blue-500
  '#EF4444', // red-500
  '#10B981', // emerald-500
  '#F59E0B', // amber-500
  '#8B5CF6', // violet-500
  '#EC4899', // pink-500
  '#06B6D4', // cyan-500
  '#F97316', // orange-500
  '#14B8A6', // teal-500
  '#6366F1', // indigo-500
  '#84CC16', // lime-500
  '#D946EF', // fuchsia-500
  '#0EA5E9', // sky-500
  '#A855F7', // purple-500
  '#22D3EE', // cyan-400
]
