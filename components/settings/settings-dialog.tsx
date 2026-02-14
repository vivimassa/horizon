'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/theme-toggle'
import { ColorSchemePicker } from './color-scheme-picker'
import { AvatarUpload } from './avatar-upload'
import { useUserPreferences, type DockPosition } from '@/hooks/use-user-preferences'
import { cn } from '@/lib/utils'

const DEFAULT_SHORTCUTS = [
  { code: '1.1.1', order: 0 },
  { code: '2.1.2', order: 1 },
  { code: '3.1.1', order: 2 },
  { code: '3.1.3', order: 3 },
  { code: '4.2.2', order: 4 },
]

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userName: string
  isAdmin: boolean
}

const dockOptions: { value: DockPosition; label: string }[] = [
  { value: 'bottom', label: 'Bottom' },
  { value: 'left', label: 'Left' },
  { value: 'top', label: 'Top' },
]

export function SettingsDialog({ open, onOpenChange, userName, isAdmin }: SettingsDialogProps) {
  const { preferences, updatePreferences } = useUserPreferences()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>mySettings</DialogTitle>
          <DialogDescription>Customize your Horizon experience.</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Appearance */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">Appearance</h4>
            <div className="flex items-center justify-between">
              <span className="text-sm">Light / Dark Mode</span>
              <ThemeToggle />
            </div>
          </div>

          {/* Color Scheme */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">Color Scheme</h4>
            <ColorSchemePicker />
          </div>

          {/* Dock Position */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">Dock Position</h4>
            <div className="flex gap-2">
              {dockOptions.map((opt) => (
                <Button
                  key={opt.value}
                  variant="outline"
                  size="sm"
                  onClick={() => updatePreferences({ dock_position: opt.value })}
                  className={cn(
                    preferences.dock_position === opt.value && 'bg-primary/15 text-primary border-primary/30'
                  )}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Avatar */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">Avatar</h4>
            <AvatarUpload userName={userName} />
          </div>

          {/* Copy Layout (admin only) */}
          {isAdmin && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">Copy Layout</h4>
              <p className="text-xs text-muted-foreground">Coming soon</p>
            </div>
          )}

          {/* Reset */}
          <div className="pt-2 border-t border-border">
            <Button
              variant="outline"
              size="sm"
              onClick={() => updatePreferences({ dashboard_layout: DEFAULT_SHORTCUTS })}
              className="text-destructive hover:text-destructive"
            >
              Reset myHorizon
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
