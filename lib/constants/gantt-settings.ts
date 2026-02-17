export interface GanttSettingsData {
  utilizationTargets: Record<string, number>
  tatOverrides: Record<string, { dd?: number; di?: number; id?: number; ii?: number }>
  barColors: { unassigned: string; assigned: string }
  display: {
    histogram: boolean
    eodBadges: boolean
    tatLabels: boolean
    conflictIndicators: boolean
    workspaceIcons: boolean
    cancelledFlights: boolean
  }
  barLabelFormat: 'full' | 'number_sector' | 'number' | 'sector'
}

export const DEFAULT_GANTT_SETTINGS: GanttSettingsData = {
  utilizationTargets: {},
  tatOverrides: {},
  barColors: { unassigned: '#DBEAFE', assigned: '#3B82F6' },
  display: {
    histogram: true,
    eodBadges: true,
    tatLabels: true,
    conflictIndicators: true,
    workspaceIcons: true,
    cancelledFlights: false,
  },
  barLabelFormat: 'full',
}
