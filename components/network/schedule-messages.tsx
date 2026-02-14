'use client'

import { useState } from 'react'
import { ScheduleSeason, AircraftType } from '@/types/database'
import { SsimManager } from './ssim-manager'
import { AsmSsmManager } from './asm-ssm-manager'
import { cn } from '@/lib/utils'
import { FileUp, MessageSquare } from 'lucide-react'

interface ScheduleMessagesProps {
  seasons: ScheduleSeason[]
  aircraftTypes: AircraftType[]
  operatorIataCode: string
}

const TABS = [
  { key: 'ssim', label: 'SSIM Upload/Download', code: '1.1.3.1', icon: FileUp },
  { key: 'asm', label: 'ASM/SSM Messages', code: '1.1.3.2', icon: MessageSquare },
] as const

export function ScheduleMessages({
  seasons, aircraftTypes, operatorIataCode,
}: ScheduleMessagesProps) {
  const [activeTab, setActiveTab] = useState<'ssim' | 'asm'>('ssim')

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex border-b">
        {TABS.map(tab => {
          const Icon = tab.icon
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px',
                activeTab === tab.key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border',
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              <span className="text-[10px] text-muted-foreground font-mono ml-1">({tab.code})</span>
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      {activeTab === 'ssim' && (
        <SsimManager
          seasons={seasons}
          aircraftTypes={aircraftTypes}
          operatorIataCode={operatorIataCode}
        />
      )}
      {activeTab === 'asm' && (
        <AsmSsmManager
          operatorIataCode={operatorIataCode}
        />
      )}
    </div>
  )
}
