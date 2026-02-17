'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { getGanttSettings, saveGanttSettings } from '@/app/actions/gantt-settings'
import { DEFAULT_GANTT_SETTINGS, type GanttSettingsData } from '@/lib/constants/gantt-settings'
import { lightToDark, getBarTextColor } from '@/lib/utils/color-helpers'

export type { GanttSettingsData }
export { DEFAULT_GANTT_SETTINGS }

const STORAGE_KEY = 'gantt_settings_v1'
const OLD_BAR_COLORS_KEY = 'gantt_bar_colors'

type SaveStatus = 'idle' | 'saving' | 'saved'

/** Merge partial stored data with defaults so every key is guaranteed present. */
function mergeWithDefaults(partial: Record<string, unknown>): GanttSettingsData {
  return {
    utilizationTargets: (partial.utilizationTargets as Record<string, number> | undefined) ?? { ...DEFAULT_GANTT_SETTINGS.utilizationTargets },
    tatOverrides: (partial.tatOverrides as GanttSettingsData['tatOverrides'] | undefined) ?? { ...DEFAULT_GANTT_SETTINGS.tatOverrides },
    barColors: { ...DEFAULT_GANTT_SETTINGS.barColors, ...(partial.barColors as object | undefined) },
    display: { ...DEFAULT_GANTT_SETTINGS.display, ...(partial.display as object | undefined) },
    barLabelFormat: (partial.barLabelFormat as GanttSettingsData['barLabelFormat'] | undefined) ?? DEFAULT_GANTT_SETTINGS.barLabelFormat,
  }
}

/** Old bar colors that should be migrated to the new scheme. */
const OLD_PASTEL_COLORS = new Set(['#FFFFFF', '#ffffff', '#DCFCE7', '#dcfce7'])

function loadFromStorage(): GanttSettingsData {
  if (typeof window === 'undefined') return { ...DEFAULT_GANTT_SETTINGS }
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = mergeWithDefaults(JSON.parse(stored))
      // Migrate old pastel bar colors → new vivid defaults
      let migrated = false
      if (OLD_PASTEL_COLORS.has(parsed.barColors.unassigned)) {
        parsed.barColors.unassigned = DEFAULT_GANTT_SETTINGS.barColors.unassigned
        migrated = true
      }
      if (OLD_PASTEL_COLORS.has(parsed.barColors.assigned)) {
        parsed.barColors.assigned = DEFAULT_GANTT_SETTINGS.barColors.assigned
        migrated = true
      }
      if (migrated) saveToStorage(parsed)
      return parsed
    }
    // Migration shim: import old bar colors
    const oldColors = localStorage.getItem(OLD_BAR_COLORS_KEY)
    if (oldColors) {
      const colors = JSON.parse(oldColors)
      const migrated = mergeWithDefaults({ barColors: colors })
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated))
      localStorage.removeItem(OLD_BAR_COLORS_KEY)
      return migrated
    }
  } catch { /* ignore */ }
  return { ...DEFAULT_GANTT_SETTINGS }
}

function saveToStorage(settings: GanttSettingsData) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)) } catch { /* ignore */ }
}

/** Dark-mode companion for the assigned bar color. The generic lightToDark
 *  works for pastel fills but not for vivid mid-tone blues like #3B82F6,
 *  so we provide a hardcoded mapping for the default and derive the rest. */
function assignedDark(lightHex: string): string {
  if (lightHex.toUpperCase() === '#3B82F6') return '#1E40AF'
  return lightToDark(lightHex)
}

function unassignedDark(lightHex: string): string {
  if (lightHex.toUpperCase() === '#DBEAFE') return '#1E293B'
  if (lightHex.toUpperCase() === '#FFFFFF') return '#1e1e1e'
  return lightToDark(lightHex)
}

function applyCssVars(settings: GanttSettingsData) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  const isDark = root.classList.contains('dark')
  const barColors = settings.barColors ?? DEFAULT_GANTT_SETTINGS.barColors

  root.style.setProperty('--gantt-bar-bg-unassigned', isDark ? unassignedDark(barColors.unassigned) : barColors.unassigned)
  root.style.setProperty('--gantt-bar-bg-assigned', isDark ? assignedDark(barColors.assigned) : barColors.assigned)
  root.style.setProperty('--gantt-bar-text-unassigned', getBarTextColor(barColors.unassigned, isDark))
  root.style.setProperty('--gantt-bar-text-assigned', getBarTextColor(barColors.assigned, isDark))
}

export function useGanttSettings() {
  const [settings, setSettings] = useState<GanttSettingsData>(loadFromStorage)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef = useRef(true)

  // Apply CSS vars on mount and when settings change
  useEffect(() => {
    applyCssVars(settings)
  }, [settings])

  // MutationObserver to re-apply CSS vars when dark mode toggles
  useEffect(() => {
    const observer = new MutationObserver(() => {
      applyCssVars(settings)
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [settings])

  // Background Supabase fetch on mount
  useEffect(() => {
    mountedRef.current = true
    getGanttSettings().then(remote => {
      if (!mountedRef.current || !remote) return
      // Merge remote into local (remote wins for any keys it has)
      setSettings(prev => {
        const merged = mergeWithDefaults({
          ...prev,
          ...remote,
          display: { ...prev.display, ...(remote.display ?? {}) },
          barColors: { ...prev.barColors, ...(remote.barColors ?? {}) },
          utilizationTargets: { ...(prev.utilizationTargets ?? {}), ...(remote.utilizationTargets ?? {}) },
          tatOverrides: { ...(prev.tatOverrides ?? {}), ...(remote.tatOverrides ?? {}) },
        })
        saveToStorage(merged)
        return merged
      })
    })
    return () => { mountedRef.current = false }
  }, [])

  // Cleanup timers
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
    }
  }, [])

  const debouncedSave = useCallback((next: GanttSettingsData) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setSaveStatus('saving')
      await saveGanttSettings(next)
      if (!mountedRef.current) return
      setSaveStatus('saved')
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
      savedTimerRef.current = setTimeout(() => {
        if (mountedRef.current) setSaveStatus('idle')
      }, 2000)
    }, 1500)
  }, [])

  const applyUpdate = useCallback((updater: (prev: GanttSettingsData) => GanttSettingsData) => {
    setSettings(prev => {
      const next = updater(prev)
      saveToStorage(next)
      debouncedSave(next)
      return next
    })
  }, [debouncedSave])

  const updateSettings = useCallback((partial: Partial<GanttSettingsData>) => {
    applyUpdate(prev => ({ ...prev, ...partial }))
  }, [applyUpdate])

  const updateDisplay = useCallback((key: keyof GanttSettingsData['display'], value: boolean) => {
    applyUpdate(prev => ({ ...prev, display: { ...prev.display, [key]: value } }))
  }, [applyUpdate])

  const updateBarColors = useCallback((colors: Partial<GanttSettingsData['barColors']>) => {
    applyUpdate(prev => ({ ...prev, barColors: { ...prev.barColors, ...colors } }))
  }, [applyUpdate])

  const updateUtilTarget = useCallback((icaoType: string, hours: number) => {
    applyUpdate(prev => ({
      ...prev,
      utilizationTargets: { ...prev.utilizationTargets, [icaoType]: hours },
    }))
  }, [applyUpdate])

  const resetUtilTarget = useCallback((icaoType: string) => {
    applyUpdate(prev => {
      const next = { ...prev.utilizationTargets }
      delete next[icaoType]
      return { ...prev, utilizationTargets: next }
    })
  }, [applyUpdate])

  const updateTatOverride = useCallback((icaoType: string, overrides: { dd?: number; di?: number; id?: number; ii?: number }) => {
    applyUpdate(prev => ({
      ...prev,
      tatOverrides: { ...prev.tatOverrides, [icaoType]: { ...prev.tatOverrides[icaoType], ...overrides } },
    }))
  }, [applyUpdate])

  const resetTatOverride = useCallback((icaoType: string) => {
    applyUpdate(prev => {
      const next = { ...prev.tatOverrides }
      delete next[icaoType]
      return { ...prev, tatOverrides: next }
    })
  }, [applyUpdate])

  const resetAll = useCallback(() => {
    const defaults = { ...DEFAULT_GANTT_SETTINGS }
    setSettings(defaults)
    saveToStorage(defaults)
    debouncedSave(defaults)
  }, [debouncedSave])

  return {
    settings,
    updateSettings,
    updateDisplay,
    updateBarColors,
    updateUtilTarget,
    resetUtilTarget,
    updateTatOverride,
    resetTatOverride,
    resetAll,
    saveStatus,
  }
}
