const VALID_BADGE_COLORS = new Set([
  'primary',
  'secondary',
  'success',
  'info',
  'warning',
  'error',
  'neutral'
])

export function orderStatusBadgeColor(value: string) {
  return VALID_BADGE_COLORS.has(value) ? value : 'neutral'
}
