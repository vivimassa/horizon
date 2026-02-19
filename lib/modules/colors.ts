export const moduleColors: Record<string, { bg: string; text: string; hsl: string; cardBg?: string }> = {
  network:    { bg: 'bg-yellow-500/15', text: 'text-yellow-600 dark:text-yellow-400', hsl: '45 93% 47%' },
  operations: { bg: 'bg-red-500/15',    text: 'text-red-600 dark:text-red-400',       hsl: '0 84% 60%' },
  workforce:  { bg: 'bg-green-500/15',  text: 'text-green-600 dark:text-green-400',   hsl: '142 71% 45%' },
  admin:      { bg: 'bg-slate-500/15',  text: 'text-slate-600 dark:text-slate-400',   hsl: '215 14% 47%', cardBg: 'bg-slate-100/60 dark:bg-slate-500/10' },
}

export function getModuleColor(moduleId: string) {
  return moduleColors[moduleId] ?? null
}

/** Map top-level module code prefix to module ID */
const codeToModule: Record<string, string> = {
  '1': 'network',
  '2': 'operations',
  '3': 'workforce',
  '4': 'admin',
}

/** Derive module color from a hierarchical code like "1.1.3" */
export function getModuleColorByCode(code: string) {
  const prefix = code.charAt(0)
  const moduleId = codeToModule[prefix]
  return moduleId ? getModuleColor(moduleId) : null
}
