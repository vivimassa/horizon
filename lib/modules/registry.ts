export interface ModuleEntry {
  code: string
  name: string
  description: string
  icon: string
  route: string
  parent_module: string | null
  parent_code: string | null
  required_module: string | null
  level: number
}

/**
 * Complete Horizon module registry.
 * Codes follow a hierarchical numbering system:
 *   1. Network  2. Operations  3. Workforce  4. Admin
 *   x.1 Control  x.2 Tools  x.3 Reports
 *   x.y.z Leaf items
 */
export const MODULE_REGISTRY: ModuleEntry[] = [
  // ──────────────────────────────────────────────
  // 1. NETWORK
  // ──────────────────────────────────────────────
  { code: '1', name: 'Network', description: 'Route management, airports, and fleet infrastructure', icon: 'Network', route: '/network', parent_module: null, parent_code: null, required_module: 'network', level: 0 },

  // 1.1 Control
  { code: '1.1', name: 'Control', description: 'Schedule planning, administration, and distribution', icon: 'Settings', route: '/network/control', parent_module: 'Network', parent_code: '1', required_module: 'network', level: 1 },
  // Schedule Planning
  { code: '1.1.1', name: 'Schedule Builder', description: 'Create and manage aircraft routes with flight legs, frequencies, and seasonal periods', icon: 'PenLine', route: '/network/control/schedule-builder', parent_module: 'Control', parent_code: '1.1', required_module: 'network', level: 2 },
  { code: '1.1.2', name: 'Schedule Grid', description: 'Tabular view of all scheduled flights with inline editing and bulk operations', icon: 'LayoutGrid', route: '/network/control/schedule-grid', parent_module: 'Control', parent_code: '1.1', required_module: 'network', level: 2 },
  { code: '1.1.3', name: 'Gantt Chart', description: 'Aircraft rotation timeline showing fleet utilization and tail assignment', icon: 'GanttChart', route: '/network/control/schedule-gantt', parent_module: 'Control', parent_code: '1.1', required_module: 'network', level: 2 },
  { code: '1.1.4', name: 'Schedule Comparison', description: 'Compare planning scenarios side by side', icon: 'GitCompareArrows', route: '/network/control/schedule-comparison', parent_module: 'Control', parent_code: '1.1', required_module: 'network', level: 2 },
  // Schedule Administration
  { code: '1.1.5', name: 'Schedule Publish', description: 'Review, approve, and publish planning scenarios to the active schedule', icon: 'SendHorizonal', route: '/network/control/schedule-publish', parent_module: 'Control', parent_code: '1.1', required_module: 'network', level: 2 },
  { code: '1.1.6', name: 'Codeshare Manager', description: 'Manage codeshare agreements and partner flight designators', icon: 'Link2', route: '/network/control/codeshare-manager', parent_module: 'Control', parent_code: '1.1', required_module: 'network', level: 2 },
  { code: '1.1.7', name: 'Slot Manager', description: 'Track airport slot allocations and IATA 80/20 utilization', icon: 'CalendarClock', route: '/network/control/slot-manager', parent_module: 'Control', parent_code: '1.1', required_module: 'network', level: 2 },
  { code: '1.1.8', name: 'Charter Manager', description: 'Manage ad-hoc and charter flight operations', icon: 'PlaneTakeoff', route: '/network/control/charter-manager', parent_module: 'Control', parent_code: '1.1', required_module: 'network', level: 2 },
  // Schedule Distribution
  { code: '1.1.9', name: 'Schedule Messaging', description: 'Generate and process ASM and SSM messages for schedule distribution', icon: 'MessageSquareShare', route: '/network/control/schedule-messaging', parent_module: 'Control', parent_code: '1.1', required_module: 'network', level: 2 },
  { code: '1.1.10', name: 'SSIM Exchange', description: 'Import and export SSIM format files for airports and distribution systems', icon: 'FileInput', route: '/network/control/ssim-exchange', parent_module: 'Control', parent_code: '1.1', required_module: 'network', level: 2 },

  // 1.2 Tools
  { code: '1.2', name: 'Tools', description: 'Network tools and utilities', icon: 'Wrench', route: '/network/tools', parent_module: 'Network', parent_code: '1', required_module: 'network', level: 1 },

  // 1.3 Reports
  { code: '1.3', name: 'Reports', description: 'Network reports and analytics', icon: 'FileText', route: '/network/reports', parent_module: 'Network', parent_code: '1', required_module: 'network', level: 1 },
  { code: '1.3.1', name: 'Daily Flight Schedule', description: 'View daily flight schedules in tabular form', icon: 'CalendarDays', route: '/network/reports/daily-schedule', parent_module: 'Reports', parent_code: '1.3', required_module: 'network', level: 2 },
  { code: '1.3.2', name: 'Fleet Utilization', description: 'Scheduled fleet utilization analysis', icon: 'BarChart3', route: '/network/reports/fleet-utilization', parent_module: 'Reports', parent_code: '1.3', required_module: 'network', level: 2 },
  { code: '1.3.3', name: 'Network Summary', description: 'Overall network statistics', icon: 'LayoutDashboard', route: '/network/reports/network-summary', parent_module: 'Reports', parent_code: '1.3', required_module: 'network', level: 2 },
  { code: '1.3.4', name: 'Slot Utilisation', description: 'Airport slot utilisation analysis', icon: 'PieChart', route: '/network/reports/slot-utilisation', parent_module: 'Reports', parent_code: '1.3', required_module: 'network', level: 2 },

  // ──────────────────────────────────────────────
  // 2. OPERATIONS
  // ──────────────────────────────────────────────
  { code: '2', name: 'Operations', description: 'Flight operations, scheduling, and dispatch', icon: 'Cog', route: '/operations', parent_module: null, parent_code: null, required_module: 'operations', level: 0 },

  // 2.1 Control
  { code: '2.1', name: 'Control', description: 'Operations control panel', icon: 'Settings', route: '/operations/control', parent_module: 'Operations', parent_code: '2', required_module: 'operations', level: 1 },
  { code: '2.1.1', name: 'Flight Board', description: 'Real-time flight status board', icon: 'Monitor', route: '/operations/control/flight-board', parent_module: 'Control', parent_code: '2.1', required_module: 'operations', level: 2 },
  { code: '2.1.2', name: 'Aircraft Gantt', description: 'Aircraft utilisation Gantt chart', icon: 'GanttChart', route: '/operations/control/aircraft-gantt', parent_module: 'Control', parent_code: '2.1', required_module: 'operations', level: 2 },
  { code: '2.1.3', name: 'Dispatch Console', description: 'Flight dispatch and release', icon: 'Radio', route: '/operations/control/dispatch-console', parent_module: 'Control', parent_code: '2.1', required_module: 'operations', level: 2 },
  { code: '2.1.4', name: 'Delay Manager', description: 'Delay tracking and management', icon: 'AlertTriangle', route: '/operations/control/delay-manager', parent_module: 'Control', parent_code: '2.1', required_module: 'operations', level: 2 },
  { code: '2.1.5', name: 'Movement Log', description: 'Aircraft movement tracking', icon: 'ListOrdered', route: '/operations/control/movement-log', parent_module: 'Control', parent_code: '2.1', required_module: 'operations', level: 2 },
  { code: '2.1.6', name: 'OCC Dashboard', description: 'Operations control centre overview', icon: 'LayoutDashboard', route: '/operations/control/occ-dashboard', parent_module: 'Control', parent_code: '2.1', required_module: 'operations', level: 2 },
  { code: '2.1.7', name: 'Disruption Manager', description: 'Handle disruptions and irregularities', icon: 'ShieldAlert', route: '/operations/control/disruption-manager', parent_module: 'Control', parent_code: '2.1', required_module: 'operations', level: 2 },
  { code: '2.1.8', name: 'Maintenance Tracker', description: 'Track maintenance events', icon: 'Wrench', route: '/operations/control/maintenance-tracker', parent_module: 'Control', parent_code: '2.1', required_module: 'operations', level: 2 },
  { code: '2.1.9', name: 'Fuel Planner', description: 'Fuel uplift planning', icon: 'Fuel', route: '/operations/control/fuel-planner', parent_module: 'Control', parent_code: '2.1', required_module: 'operations', level: 2 },

  // 2.2 Tools
  { code: '2.2', name: 'Tools', description: 'Operations tools and utilities', icon: 'Wrench', route: '/operations/tools', parent_module: 'Operations', parent_code: '2', required_module: 'operations', level: 1 },

  // 2.3 Reports
  { code: '2.3', name: 'Reports', description: 'Operations reports and analytics', icon: 'FileText', route: '/operations/reports', parent_module: 'Operations', parent_code: '2', required_module: 'operations', level: 1 },
  { code: '2.3.1', name: 'OTP Report', description: 'On-time performance analysis', icon: 'Clock', route: '/operations/reports/otp-report', parent_module: 'Reports', parent_code: '2.3', required_module: 'operations', level: 2 },
  { code: '2.3.2', name: 'Delay Analysis', description: 'Delay statistics and trends', icon: 'BarChart3', route: '/operations/reports/delay-analysis', parent_module: 'Reports', parent_code: '2.3', required_module: 'operations', level: 2 },
  { code: '2.3.3', name: 'Utilisation Report', description: 'Aircraft utilisation metrics', icon: 'TrendingUp', route: '/operations/reports/utilisation-report', parent_module: 'Reports', parent_code: '2.3', required_module: 'operations', level: 2 },

  // ──────────────────────────────────────────────
  // 3. WORKFORCE
  // ──────────────────────────────────────────────
  { code: '3', name: 'Workforce', description: 'Crew management, rostering, and personnel', icon: 'Users', route: '/workforce', parent_module: null, parent_code: null, required_module: 'workforce', level: 0 },

  // 3.1 Control
  { code: '3.1', name: 'Control', description: 'Workforce control panel', icon: 'Settings', route: '/workforce/control', parent_module: 'Workforce', parent_code: '3', required_module: 'workforce', level: 1 },
  { code: '3.1.1', name: 'Crew Directory', description: 'Browse and manage crew records', icon: 'Users', route: '/workforce/control/crew-directory', parent_module: 'Control', parent_code: '3.1', required_module: 'workforce', level: 2 },
  { code: '3.1.2', name: 'Roster Builder', description: 'Build and publish crew rosters', icon: 'CalendarPlus', route: '/workforce/control/roster-builder', parent_module: 'Control', parent_code: '3.1', required_module: 'workforce', level: 2 },
  { code: '3.1.3', name: 'FDTL Monitor', description: 'Flight duty time limits monitoring', icon: 'Timer', route: '/workforce/control/fdtl-monitor', parent_module: 'Control', parent_code: '3.1', required_module: 'workforce', level: 2 },
  { code: '3.1.4', name: 'Crew Pairing', description: 'Crew pairing optimisation', icon: 'GitMerge', route: '/workforce/control/crew-pairing', parent_module: 'Control', parent_code: '3.1', required_module: 'workforce', level: 2 },
  { code: '3.1.5', name: 'Leave Manager', description: 'Crew leave and absence tracking', icon: 'CalendarOff', route: '/workforce/control/leave-manager', parent_module: 'Control', parent_code: '3.1', required_module: 'workforce', level: 2 },
  { code: '3.1.6', name: 'Training Tracker', description: 'Track crew training and qualifications', icon: 'GraduationCap', route: '/workforce/control/training-tracker', parent_module: 'Control', parent_code: '3.1', required_module: 'workforce', level: 2 },
  { code: '3.1.7', name: 'Crew Requests', description: 'Manage crew swap and bid requests', icon: 'MessageSquare', route: '/workforce/control/crew-requests', parent_module: 'Control', parent_code: '3.1', required_module: 'workforce', level: 2 },
  { code: '3.1.8', name: 'Standby Manager', description: 'Standby and reserve crew management', icon: 'UserCheck', route: '/workforce/control/standby-manager', parent_module: 'Control', parent_code: '3.1', required_module: 'workforce', level: 2 },
  { code: '3.1.9', name: 'Crew Gantt', description: 'Crew schedule Gantt view', icon: 'GanttChart', route: '/workforce/control/crew-gantt', parent_module: 'Control', parent_code: '3.1', required_module: 'workforce', level: 2 },

  // 3.2 Tools
  { code: '3.2', name: 'Tools', description: 'Workforce tools and utilities', icon: 'Wrench', route: '/workforce/tools', parent_module: 'Workforce', parent_code: '3', required_module: 'workforce', level: 1 },

  // 3.3 Reports
  { code: '3.3', name: 'Reports', description: 'Workforce reports and analytics', icon: 'FileText', route: '/workforce/reports', parent_module: 'Workforce', parent_code: '3', required_module: 'workforce', level: 1 },
  { code: '3.3.1', name: 'FDTL Report', description: 'Flight duty time analysis', icon: 'Clock', route: '/workforce/reports/fdtl-report', parent_module: 'Reports', parent_code: '3.3', required_module: 'workforce', level: 2 },
  { code: '3.3.2', name: 'Roster Summary', description: 'Roster coverage and statistics', icon: 'BarChart3', route: '/workforce/reports/roster-summary', parent_module: 'Reports', parent_code: '3.3', required_module: 'workforce', level: 2 },
  { code: '3.3.3', name: 'Training Compliance', description: 'Training compliance overview', icon: 'CheckCircle', route: '/workforce/reports/training-compliance', parent_module: 'Reports', parent_code: '3.3', required_module: 'workforce', level: 2 },

  // ──────────────────────────────────────────────
  // 4. ADMIN
  // ──────────────────────────────────────────────
  { code: '4', name: 'Admin', description: 'System administration and configuration', icon: 'Shield', route: '/admin', parent_module: null, parent_code: null, required_module: 'admin', level: 0 },

  // 4.1 System
  { code: '4.1', name: 'System', description: 'Core system settings', icon: 'Settings', route: '/admin/system', parent_module: 'Admin', parent_code: '4', required_module: 'admin', level: 1 },
  { code: '4.1.1', name: 'Operator Profile', description: 'Manage operator company profile', icon: 'Building2', route: '/admin/system/operator-profile', parent_module: 'System', parent_code: '4.1', required_module: 'admin', level: 2 },
  { code: '4.1.2', name: 'User Management', description: 'Manage users and access', icon: 'UserCog', route: '/admin/system/users', parent_module: 'System', parent_code: '4.1', required_module: 'admin', level: 2 },
  { code: '4.1.3', name: 'Module Management', description: 'Enable and configure modules', icon: 'LayoutGrid', route: '/admin/system/modules', parent_module: 'System', parent_code: '4.1', required_module: 'admin', level: 2 },
  { code: '4.1.4', name: 'Notifications', description: 'Notification settings', icon: 'Bell', route: '/admin/system/notifications', parent_module: 'System', parent_code: '4.1', required_module: 'admin', level: 2 },
  { code: '4.1.5', name: 'Integrations', description: 'Integration settings', icon: 'Plug', route: '/admin/system/integrations', parent_module: 'System', parent_code: '4.1', required_module: 'admin', level: 2 },

  // 4.2 Master Database
  { code: '4.2', name: 'Master Database', description: 'Core reference data', icon: 'Database', route: '/admin/master-database', parent_module: 'Admin', parent_code: '4', required_module: 'admin', level: 1 },
  { code: '4.2.1', name: 'Countries', description: 'Country reference data', icon: 'Globe', route: '/admin/master-database/countries', parent_module: 'Master Database', parent_code: '4.2', required_module: 'admin', level: 2 },
  { code: '4.2.2', name: 'Airports', description: 'Airport database management', icon: 'PlaneLanding', route: '/admin/master-database/airports', parent_module: 'Master Database', parent_code: '4.2', required_module: 'admin', level: 2 },
  { code: '4.2.3', name: 'Aircraft Types', description: 'Aircraft type catalogue', icon: 'Plane', route: '/admin/master-database/aircraft-types', parent_module: 'Master Database', parent_code: '4.2', required_module: 'admin', level: 2 },
  { code: '4.2.4', name: 'Aircraft Registrations', description: 'Individual aircraft fleet registry', icon: 'PlaneTakeoff', route: '/admin/master-database/aircraft-registrations', parent_module: 'Master Database', parent_code: '4.2', required_module: 'admin', level: 2 },
  { code: '4.2.5', name: 'Airlines', description: 'Airline reference data', icon: 'Building', route: '/admin/master-database/airlines', parent_module: 'Master Database', parent_code: '4.2', required_module: 'admin', level: 2 },
  { code: '4.2.6', name: 'City Pairs', description: 'City pair connections', icon: 'ArrowLeftRight', route: '/admin/master-database/city-pairs', parent_module: 'Master Database', parent_code: '4.2', required_module: 'admin', level: 2 },
  { code: '4.2.7', name: 'Flight Service Types', description: 'Flight service type codes', icon: 'Tag', route: '/admin/master-database/flight-service-types', parent_module: 'Master Database', parent_code: '4.2', required_module: 'admin', level: 2 },
  { code: '4.2.8', name: 'Delay Codes', description: 'IATA delay code definitions', icon: 'AlertTriangle', route: '/admin/master-database/delay-codes', parent_module: 'Master Database', parent_code: '4.2', required_module: 'admin', level: 2 },
  { code: '4.2.9', name: 'Cabin Classes', description: 'Cabin class definitions', icon: 'Armchair', route: '/admin/master-database/cabin-classes', parent_module: 'Master Database', parent_code: '4.2', required_module: 'admin', level: 2 },
  { code: '4.2.10', name: 'Units of Measure', description: 'System-wide unit display preferences', icon: 'Ruler', route: '/admin/master-database/units-of-measure', parent_module: 'Master Database', parent_code: '4.2', required_module: 'admin', level: 2 },

  // 4.3 Network Config
  { code: '4.3', name: 'Network Config', description: 'Network module configuration', icon: 'Network', route: '/admin/network-config', parent_module: 'Admin', parent_code: '4', required_module: 'admin', level: 1 },
  { code: '4.3.1', name: 'Schedule Seasons', description: 'Define schedule seasons', icon: 'Calendar', route: '/admin/network-config/schedule-seasons', parent_module: 'Network Config', parent_code: '4.3', required_module: 'admin', level: 2 },
  { code: '4.3.2', name: 'Codeshare Config', description: 'Codeshare agreement settings', icon: 'Link', route: '/admin/network-config/codeshare-config', parent_module: 'Network Config', parent_code: '4.3', required_module: 'admin', level: 2 },
  { code: '4.3.3', name: 'Schedule Preferences & Restrictions', description: 'Rules and constraints for tail assignment optimization', icon: 'SlidersHorizontal', route: '/admin/network-config/schedule-preferences', parent_module: 'Network Config', parent_code: '4.3', required_module: 'admin', level: 2 },
  { code: '4.3.4', name: 'Cabin Config', description: 'Cabin configuration settings', icon: 'Armchair', route: '/admin/network-config/cabin-config', parent_module: 'Network Config', parent_code: '4.3', required_module: 'admin', level: 2 },
  { code: '4.3.5', name: 'Schedule Templates', description: 'Schedule template definitions', icon: 'FileSpreadsheet', route: '/admin/network-config/schedule-templates', parent_module: 'Network Config', parent_code: '4.3', required_module: 'admin', level: 2 },
  { code: '4.3.6', name: 'Service Types', description: 'Flight service type configuration', icon: 'Tag', route: '/admin/network-config/service-types', parent_module: 'Network Config', parent_code: '4.3', required_module: 'admin', level: 2 },

  // 4.4 Operations Config
  { code: '4.4', name: 'Operations Config', description: 'Operations module configuration', icon: 'Cog', route: '/admin/operations-config', parent_module: 'Admin', parent_code: '4', required_module: 'admin', level: 1 },
  { code: '4.4.1', name: 'Flight Status Rules', description: 'Flight status transition rules', icon: 'GitBranch', route: '/admin/operations-config/flight-status-rules', parent_module: 'Operations Config', parent_code: '4.4', required_module: 'admin', level: 2 },
  { code: '4.4.2', name: 'Diversion Airports', description: 'Designated diversion airports', icon: 'MapPin', route: '/admin/operations-config/diversion-airports', parent_module: 'Operations Config', parent_code: '4.4', required_module: 'admin', level: 2 },
  { code: '4.4.3', name: 'Ground Time Rules', description: 'Minimum ground time configuration', icon: 'Timer', route: '/admin/operations-config/ground-time-rules', parent_module: 'Operations Config', parent_code: '4.4', required_module: 'admin', level: 2 },
  { code: '4.4.4', name: 'Alert Thresholds', description: 'Operational alert configuration', icon: 'Bell', route: '/admin/operations-config/alert-thresholds', parent_module: 'Operations Config', parent_code: '4.4', required_module: 'admin', level: 2 },
  { code: '4.4.5', name: 'Message Configuration', description: 'Operational messaging settings', icon: 'MessageCircle', route: '/admin/operations-config/message-config', parent_module: 'Operations Config', parent_code: '4.4', required_module: 'admin', level: 2 },
  { code: '4.4.6', name: 'OCC Desk Configuration', description: 'OCC desk layout and roles', icon: 'Monitor', route: '/admin/operations-config/occ-desk-config', parent_module: 'Operations Config', parent_code: '4.4', required_module: 'admin', level: 2 },
  { code: '4.4.7', name: 'Maintenance Types', description: 'Maintenance event type definitions', icon: 'Wrench', route: '/admin/operations-config/maintenance-types', parent_module: 'Operations Config', parent_code: '4.4', required_module: 'admin', level: 2 },
  { code: '4.4.8', name: 'Delay Codes', description: 'Operational delay code configuration', icon: 'AlertTriangle', route: '/admin/operations-config/delay-codes', parent_module: 'Operations Config', parent_code: '4.4', required_module: 'admin', level: 2 },

  // 4.5 Workforce Config
  { code: '4.5', name: 'Workforce Config', description: 'Workforce module configuration', icon: 'Users', route: '/admin/workforce-config', parent_module: 'Admin', parent_code: '4', required_module: 'admin', level: 1 },
  { code: '4.5.1', name: 'Crew Ranks', description: 'Crew rank definitions', icon: 'Award', route: '/admin/workforce-config/crew-ranks', parent_module: 'Workforce Config', parent_code: '4.5', required_module: 'admin', level: 2 },
  { code: '4.5.2', name: 'Crew Bases', description: 'Crew base locations', icon: 'MapPin', route: '/admin/workforce-config/crew-bases', parent_module: 'Workforce Config', parent_code: '4.5', required_module: 'admin', level: 2 },
  { code: '4.5.3', name: 'Qualification Types', description: 'Crew qualification definitions', icon: 'BadgeCheck', route: '/admin/workforce-config/qualification-types', parent_module: 'Workforce Config', parent_code: '4.5', required_module: 'admin', level: 2 },
  { code: '4.5.4', name: 'Activity Codes', description: 'Roster activity code definitions', icon: 'Tag', route: '/admin/workforce-config/activity-codes', parent_module: 'Workforce Config', parent_code: '4.5', required_module: 'admin', level: 2 },
  { code: '4.5.5', name: 'FDTL Rule Sets', description: 'Flight duty time limit rule sets', icon: 'Scale', route: '/admin/workforce-config/fdtl-rule-sets', parent_module: 'Workforce Config', parent_code: '4.5', required_module: 'admin', level: 2 },
  { code: '4.5.6', name: 'FDTL Rule Advisor', description: 'FDTL compliance advisory tool', icon: 'Bot', route: '/admin/workforce-config/fdtl-rule-advisor', parent_module: 'Workforce Config', parent_code: '4.5', required_module: 'admin', level: 2 },
  { code: '4.5.7', name: 'Roster Rules', description: 'Rostering constraint rules', icon: 'ListChecks', route: '/admin/workforce-config/roster-rules', parent_module: 'Workforce Config', parent_code: '4.5', required_module: 'admin', level: 2 },
  { code: '4.5.8', name: 'Crew Groups', description: 'Crew grouping definitions', icon: 'UsersRound', route: '/admin/workforce-config/crew-groups', parent_module: 'Workforce Config', parent_code: '4.5', required_module: 'admin', level: 2 },
  { code: '4.5.9', name: 'Request Types', description: 'Crew request type definitions', icon: 'FileQuestion', route: '/admin/workforce-config/request-types', parent_module: 'Workforce Config', parent_code: '4.5', required_module: 'admin', level: 2 },
  { code: '4.5.10', name: 'Seniority Rules', description: 'Crew seniority calculation rules', icon: 'Trophy', route: '/admin/workforce-config/seniority-rules', parent_module: 'Workforce Config', parent_code: '4.5', required_module: 'admin', level: 2 },

  // 4.6 Addon Config
  { code: '4.6', name: 'Addon Config', description: 'Addon module management', icon: 'Puzzle', route: '/admin/addon-config', parent_module: 'Admin', parent_code: '4', required_module: 'admin', level: 1 },
]

// ─── Index maps for fast lookup ────────────────
const byCode = new Map<string, ModuleEntry>()
const byRoute = new Map<string, ModuleEntry>()
for (const m of MODULE_REGISTRY) {
  byCode.set(m.code, m)
  byRoute.set(m.route, m)
}

/** Get a module by its hierarchical code (e.g. "2.1.2") */
export function getModuleByCode(code: string): ModuleEntry | undefined {
  return byCode.get(code)
}

/** Get a module by its route path */
export function getModuleByRoute(route: string): ModuleEntry | undefined {
  return byRoute.get(route)
}

/** Get direct children of a given parent code */
export function getChildModules(parentCode: string): ModuleEntry[] {
  return MODULE_REGISTRY.filter(m => m.parent_code === parentCode)
}

/** Get all leaf modules (no children) */
export function getLeafModules(): ModuleEntry[] {
  const parentCodes = new Set(MODULE_REGISTRY.map(m => m.parent_code).filter(Boolean))
  return MODULE_REGISTRY.filter(m => !parentCodes.has(m.code))
}

/** Check if a module code is a leaf (has no children) */
const _parentCodes = new Set(MODULE_REGISTRY.map(m => m.parent_code).filter(Boolean))
export function isLeafModule(code: string): boolean {
  return !_parentCodes.has(code)
}

export interface ModuleTreeNode extends ModuleEntry {
  children: ModuleTreeNode[]
}

/** Build a hierarchical tree from the flat registry */
export function getModuleTree(): ModuleTreeNode[] {
  const nodeMap = new Map<string, ModuleTreeNode>()

  // Create nodes
  for (const m of MODULE_REGISTRY) {
    nodeMap.set(m.code, { ...m, children: [] })
  }

  // Build tree
  const roots: ModuleTreeNode[] = []
  for (const node of Array.from(nodeMap.values())) {
    if (node.parent_code && nodeMap.has(node.parent_code)) {
      nodeMap.get(node.parent_code)!.children.push(node)
    } else if (!node.parent_code) {
      roots.push(node)
    }
  }

  return roots
}

/** Resolve a route path to its module code chain, e.g. "/operations/control" → ["2", "2.1"] */
export function getModuleCodeChain(route: string): ModuleEntry[] {
  const chain: ModuleEntry[] = []
  const mod = byRoute.get(route)
  if (!mod) return chain

  let current: ModuleEntry | undefined = mod
  while (current) {
    chain.unshift(current)
    current = current.parent_code ? byCode.get(current.parent_code) : undefined
  }
  return chain
}
