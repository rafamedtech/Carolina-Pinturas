import { requireUser } from '../../../utils/auth'

export default eventHandler(async (event) => {
  await requireUser(event)
  throw createError({
    statusCode: 410,
    statusMessage: 'El estado de pago ahora se calcula desde los registros de /payments.'
  })
})
