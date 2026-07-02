export type BadgeColor =
  | 'primary'
  | 'secondary'
  | 'success'
  | 'info'
  | 'warning'
  | 'error'
  | 'neutral'

const VALID_BADGE_COLORS = new Set<BadgeColor>([
  'primary',
  'secondary',
  'success',
  'info',
  'warning',
  'error',
  'neutral'
])

export function orderStatusBadgeColor(value: string): BadgeColor {
  return VALID_BADGE_COLORS.has(value as BadgeColor) ? value as BadgeColor : 'neutral'
}
