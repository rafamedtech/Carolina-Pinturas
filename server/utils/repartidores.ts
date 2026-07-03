import { usePrisma } from './prisma'
import { orderNumber } from './orders'
import type { CreateRepartidorInput } from './repartidor-validation'

export async function listRepartidores(options: { onlyActive?: boolean } = {}) {
  const prisma = usePrisma()
  const [repartidores, counts] = await Promise.all([
    prisma.repartidor.findMany({
      where: options.onlyActive ? { activo: true } : undefined,
      orderBy: { nombre: 'asc' }
    }),
    prisma.salesOrder.groupBy({
      by: ['repartidorId'],
      where: { statusKey: 'entregado' },
      _count: { _all: true }
    })
  ])
  const deliveredByRepartidor = new Map(counts.map(entry => [entry.repartidorId, entry._count._all]))

  return repartidores.map(repartidor => ({
    id: repartidor.id,
    nombre: repartidor.nombre,
    telefono: repartidor.telefono,
    activo: repartidor.activo,
    esMostrador: repartidor.esMostrador,
    deliveredCount: deliveredByRepartidor.get(repartidor.id) || 0
  }))
}

export async function createRepartidor(input: CreateRepartidorInput) {
  const repartidor = await usePrisma().repartidor.create({
    data: {
      nombre: input.nombre,
      telefono: input.telefono || null
    }
  })

  return {
    id: repartidor.id,
    nombre: repartidor.nombre,
    telefono: repartidor.telefono,
    activo: repartidor.activo,
    esMostrador: repartidor.esMostrador,
    deliveredCount: 0
  }
}

export async function getRepartidorWithDeliveries(id: string) {
  const repartidor = await usePrisma().repartidor.findUnique({
    where: { id },
    include: {
      orders: {
        where: { statusKey: 'entregado' },
        include: { customer: true },
        orderBy: { orderDate: 'desc' }
      }
    }
  })

  if (!repartidor) {
    throw createError({ statusCode: 404, statusMessage: 'No se encontró el repartidor.' })
  }

  return {
    id: repartidor.id,
    nombre: repartidor.nombre,
    telefono: repartidor.telefono,
    activo: repartidor.activo,
    deliveredOrders: repartidor.orders.map(order => ({
      id: order.id,
      folio: order.folio,
      number: orderNumber(order.folio),
      customerName: order.customerNameSnapshot,
      orderDate: order.orderDate.toISOString().slice(0, 10),
      total: Number(order.total.toString())
    }))
  }
}
