'use client'

import { RotateCcw } from 'lucide-react'

interface GanttWorkspaceIndicatorProps {
  overrideCount: number
  onReset: () => void
}

export function GanttWorkspaceIndicator({ overrideCount, onReset }: GanttWorkspaceIndicatorProps) {
  if (overrideCount === 0) return null

  return (
    <div
      className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-medium select-none"
      style={{
        background: 'rgba(59, 130, 246, 0.08)',
        border: '1px solid rgba(59, 130, 246, 0.15)',
        color: '#2563eb',
      }}
    >
      <span className="animate-[pulse-icon_2s_ease-in-out_infinite]">&#10227;</span>
      <span>
        {overrideCount} manual placement{overrideCount > 1 ? 's' : ''} · session only
      </span>
      <button
        onClick={onReset}
        className="ml-1 p-0.5 rounded-full hover:bg-blue-500/15 transition-colors"
        title="Reset to auto-assignment"
      >
        <RotateCcw className="h-3 w-3" />
      </button>

      <style>{`
        @keyframes pulse-icon {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  )
}
