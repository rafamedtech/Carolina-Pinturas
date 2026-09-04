import { beforeEach, describe, expect, it, vi } from 'vitest'
import { usePrisma } from '../../server/utils/prisma'
import { replaceInternalOrderCustomers } from '../../server/utils/siigo-customer-repository'

vi.mock('../../server/utils/prisma', () => ({ usePrisma: vi.fn() }))

const firstId = '6b6ceb28-b2eb-4b98-b3dd-26648a933c81'
const secondId = 'a3279626-da6a-4eb8-a2ae-dc9e866470db'

describe('clientes de pedidos internos', () => {
  const findMany = vi.fn()
  const updateMany = vi.fn()
  const transaction = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    updateMany.mockResolvedValue({ count: 1 })
    transaction.mockImplementation((operations: Promise<unknown>[]) => Promise.all(operations))
    vi.mocked(usePrisma).mockReturnValue({
      siigoCustomer: { findMany, updateMany },
      $transaction: transaction
    } as unknown as ReturnType<typeof usePrisma>)
  })

  it('reemplaza la selección y elimina identificadores duplicados', async () => {
    findMany.mockResolvedValue([{ id: firstId }, { id: secondId }])

    await expect(replaceInternalOrderCustomers([firstId, secondId, firstId]))
      .resolves.toEqual([firstId, secondId])
    expect(updateMany).toHaveBeenNthCalledWith(1, {
      where: { isInternalOrderCustomer: true },
      data: { isInternalOrderCustomer: false }
    })
    expect(updateMany).toHaveBeenNthCalledWith(2, {
      where: { id: { in: [firstId, secondId] } },
      data: { isInternalOrderCustomer: true }
    })
    expect(findMany).toHaveBeenCalledWith({
      where: {
        id: { in: [firstId, secondId] },
        OR: [{ active: true }, { active: null }]
      },
      select: { id: true }
    })
  })

  it('rechaza clientes que no existen o no están activos', async () => {
    findMany.mockResolvedValue([{ id: firstId }])

    await expect(replaceInternalOrderCustomers([firstId, secondId]))
      .rejects.toThrow('Uno o más clientes seleccionados no están disponibles.')
    expect(transaction).not.toHaveBeenCalled()
  })
})
