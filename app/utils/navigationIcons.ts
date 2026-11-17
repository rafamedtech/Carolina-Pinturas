export const navigationIcons = {
  '/productos': 'i-lucide-package',
  '/inventario': 'i-lucide-warehouse',
  '/clientes': 'i-lucide-users',
  '/ventas': 'i-lucide-shopping-cart',
  '/compras': 'i-lucide-package-plus',
  '/igualaciones': 'i-lucide-palette'
} as const

export function navigationIconForPath(path: string) {
  const icons: Partial<Record<string, string>> = navigationIcons
  return icons[path.replace(/\/$/, '')]
}
