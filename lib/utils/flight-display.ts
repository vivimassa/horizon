import type { CSSProperties } from 'react'

/**
 * Returns inline styles for a flight table row based on its status.
 * Published = solid, normal (operational truth)
 * Draft = dashed border, italic, muted (proposed)
 * Cancelled = strikethrough, faded
 */
export function getFlightRowStyle(status: string): CSSProperties {
  if (status === 'published') {
    return {
      borderTop: '1px solid #e5e7eb',
      borderBottom: '1px solid #e5e7eb',
      fontStyle: 'normal',
      color: '#111827',
      background: 'transparent',
    }
  }
  if (status === 'draft') {
    return {
      borderTop: '1px dashed #d1d5db',
      borderBottom: '1px dashed #d1d5db',
      fontStyle: 'italic',
      color: '#6b7280',
      background: 'rgba(153, 27, 27, 0.02)',
    }
  }
  if (status === 'cancelled') {
    return {
      borderTop: '1px solid #f3f4f6',
      borderBottom: '1px solid #f3f4f6',
      fontStyle: 'normal',
      color: '#d1d5db',
      textDecoration: 'line-through',
      background: 'transparent',
    }
  }
  // Fallback (ready or unknown)
  return {
    borderTop: '1px solid #e5e7eb',
    borderBottom: '1px solid #e5e7eb',
  }
}

/**
 * Status badge text + color for display in UI.
 */
export function getFlightStatusBadge(status: string): { label: string; color: string; bg: string } {
  switch (status) {
    case 'published':
      return { label: 'Published', color: '#111827', bg: '#f3f4f6' }
    case 'draft':
      return { label: 'Draft', color: '#991b1b', bg: 'rgba(153, 27, 27, 0.08)' }
    case 'cancelled':
      return { label: 'Cancelled', color: '#9ca3af', bg: '#f9fafb' }
    default:
      return { label: status, color: '#6b7280', bg: '#f3f4f6' }
  }
}
