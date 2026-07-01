import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../../generated/prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient
}

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL

  if (!connectionString) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Falta configurar DATABASE_URL para conectar PostgreSQL.'
    })
  }

  const adapter = new PrismaPg({
    connectionString,
    max: process.env.NODE_ENV === 'production' ? 3 : 10,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000
  })

  return new PrismaClient({ adapter })
}

export function usePrisma() {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient()
  }

  return globalForPrisma.prisma
}
