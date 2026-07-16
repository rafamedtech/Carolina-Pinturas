export function resolveCreatedOrderStatusKey(
  requestedStatusKey: string,
  repartidorIsMostrador: boolean
) {
  if (requestedStatusKey !== 'borrador' && repartidorIsMostrador) {
    return 'entregado'
  }

  return requestedStatusKey
}
