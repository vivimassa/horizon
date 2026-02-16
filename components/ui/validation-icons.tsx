/**
 * VisionOS-style validation status icons.
 * Clean SVG with soft fills and gentle opacity rings.
 */

export function StatusGreen() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" className="shrink-0">
      <circle cx="11" cy="11" r="10" fill="#22c55e" opacity="0.15" />
      <circle cx="11" cy="11" r="8" fill="#22c55e" />
      <path
        d="M7.5 11l2.5 2.5 4.5-4.5"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  )
}

export function StatusYellow() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" className="shrink-0">
      <circle cx="11" cy="11" r="10" fill="#f59e0b" opacity="0.15" />
      <path d="M11 4L3 18h16L11 4z" fill="#f59e0b" />
      <path
        d="M11 10v3M11 15v0.5"
        stroke="white"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function StatusRed() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" className="shrink-0">
      <circle cx="11" cy="11" r="10" fill="#ef4444" opacity="0.15" />
      <circle cx="11" cy="11" r="8" fill="#ef4444" />
      <path
        d="M8 8l6 6M14 8l-6 6"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function StatusGray() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" className="shrink-0">
      <circle cx="11" cy="11" r="10" fill="#9ca3af" opacity="0.15" />
      <circle cx="11" cy="11" r="8" fill="#9ca3af" opacity="0.4" />
    </svg>
  )
}
