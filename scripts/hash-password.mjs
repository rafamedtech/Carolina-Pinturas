import { randomBytes, scryptSync } from 'node:crypto'

const password = process.argv.slice(2).find(argument => argument !== '--')

if (!password) {
  console.error('Uso: pnpm auth:hash -- "contraseña"')
  process.exit(1)
}

const salt = randomBytes(16)
const hash = scryptSync(password, salt, 64)

console.log(`scrypt$${salt.toString('base64url')}$${hash.toString('base64url')}`)
