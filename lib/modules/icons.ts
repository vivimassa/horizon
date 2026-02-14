import {
  Network, Cog, Users, Shield, Settings, Wrench, FileText,
  CalendarPlus, Map, PlaneTakeoff, Clock, Link, CalendarRange,
  BarChart3, FileUp, TrendingUp, LayoutDashboard, PieChart,
  Monitor, AlertTriangle, Radio, ListOrdered, ShieldAlert, Fuel,
  Timer, GitMerge, CalendarOff, GraduationCap, MessageSquare,
  UserCheck, GanttChart, CheckCircle, Building2, UserCog,
  LayoutGrid, Database, Globe, PlaneLanding, Plane, Building,
  ArrowLeftRight, Calendar, Tag, Armchair, Ban, Copy,
  GitBranch, MapPin, Bell, MessageCircle, Award, BadgeCheck,
  Scale, Bot, ListChecks, UsersRound, FileQuestion, Trophy,
  Puzzle, type LucideIcon,
} from 'lucide-react'

/** Map icon name strings (from registry) to Lucide components */
const ICON_MAP: Record<string, LucideIcon> = {
  Network, Cog, Users, Shield, Settings, Wrench, FileText,
  CalendarPlus, Map, PlaneTakeoff, Clock, Link, CalendarRange,
  BarChart3, FileUp, TrendingUp, LayoutDashboard, PieChart,
  Monitor, AlertTriangle, Radio, ListOrdered, ShieldAlert, Fuel,
  Timer, GitMerge, CalendarOff, GraduationCap, MessageSquare,
  UserCheck, GanttChart, CheckCircle, Building2, UserCog,
  LayoutGrid, Database, Globe, PlaneLanding, Plane, Building,
  ArrowLeftRight, Calendar, Tag, Armchair, Ban, Copy,
  GitBranch, MapPin, Bell, MessageCircle, Award, BadgeCheck,
  Scale, Bot, ListChecks, UsersRound, FileQuestion, Trophy,
  Puzzle,
}

export function getIcon(name: string): LucideIcon {
  return ICON_MAP[name] || Settings
}
