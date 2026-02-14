'use client'

import { useRef } from 'react'
import { useUserPreferences } from '@/hooks/use-user-preferences'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Camera, X } from 'lucide-react'

interface AvatarUploadProps {
  userName: string
}

function getInitials(name: string): string {
  return name
    .split(/[\s@]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('')
}

export function AvatarUpload({ userName }: AvatarUploadProps) {
  const { preferences, updatePreferences } = useUserPreferences()
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const canvas = document.createElement('canvas')
    canvas.width = 128
    canvas.height = 128
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const img = new Image()
    img.onload = () => {
      const size = Math.min(img.width, img.height)
      const sx = (img.width - size) / 2
      const sy = (img.height - size) / 2
      ctx.drawImage(img, sx, sy, size, size, 0, 0, 128, 128)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
      updatePreferences({ avatar_url: dataUrl })
    }
    img.src = URL.createObjectURL(file)
    e.target.value = ''
  }

  const initials = getInitials(userName)

  return (
    <div className="flex items-center gap-4">
      <div className={cn(
        'relative w-16 h-16 rounded-full overflow-hidden flex items-center justify-center',
        'bg-primary/15 text-primary font-semibold text-lg',
        'border-2 border-border'
      )}>
        {preferences.avatar_url ? (
          <img src={preferences.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
        ) : (
          <span>{initials}</span>
        )}
      </div>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileRef.current?.click()}
          className="gap-1.5"
        >
          <Camera className="h-3.5 w-3.5" />
          Change
        </Button>
        {preferences.avatar_url && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => updatePreferences({ avatar_url: '' })}
            className="gap-1.5"
          >
            <X className="h-3.5 w-3.5" />
            Remove
          </Button>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        onChange={handleFile}
        className="hidden"
      />
    </div>
  )
}
