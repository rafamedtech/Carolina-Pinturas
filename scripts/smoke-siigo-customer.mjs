#!/usr/bin/env node
// Smoke test de creación de clientes contra Siigo México.
//
// Crea un cliente de prueba (persona física, RFC TEST######XXX) usando las
// credenciales NUXT_SIIGO_* del entorno o de .env y muestra la respuesta
// completa para documentarla.
//
// ⚠️ Ejecutar SOLO contra un tenant NO productivo. Siigo México no documenta
// borrado de clientes: el cliente creado debe desactivarse a mano (PUT con
// active: false) o desde Siigo Nube.
//
// Uso:
//   node scripts/smoke-siigo-customer.mjs --yes
//   node scripts/smoke-siigo-customer.mjs --yes --country MX --state 9 --city 1

function arg(name) {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : undefined
}

if (!process.argv.includes('--yes')) {
  console.error('Este script CREA un cliente real en el tenant de Siigo configurado.')
  console.error('Confirma que el tenant NO es productivo y vuelve a ejecutar con --yes.')
  process.exit(1)
}

try {
  process.loadEnvFile('.env')
} catch {
  // Sin .env: se usan las variables ya presentes en el entorno.
}

const apiUrl = (process.env.NUXT_SIIGO_API_URL || 'https://api.siigo.mx').replace(/\/$/, '')
const username = process.env.NUXT_SIIGO_USERNAME
const accessKey = process.env.NUXT_SIIGO_ACCESS_KEY
const applicationId = process.env.NUXT_SIIGO_APPLICATION_ID || 'CarolinaPinturas'

if (!username || !accessKey) {
  console.error('Faltan NUXT_SIIGO_USERNAME / NUXT_SIIGO_ACCESS_KEY en el entorno.')
  process.exit(1)
}

async function siigoFetch(path, options = {}) {
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'SiigoAPI-Application-Id': applicationId,
      ...options.headers
    }
  })
  const text = await response.text()
  let body
  try {
    body = JSON.parse(text)
  } catch {
    body = text
  }
  return { status: response.status, body }
}

const auth = await siigoFetch('/auth', {
  method: 'POST',
  body: JSON.stringify({ username, access_key: accessKey })
})

if (auth.status !== 200 || !auth.body?.access_token) {
  console.error(`Autenticación falló (HTTP ${auth.status}):`)
  console.error(JSON.stringify(auth.body, null, 2))
  process.exit(1)
}

const authHeaders = { Authorization: auth.body.access_token }

// Códigos de ciudad: por argumento o tomados del primer cliente existente.
let city = arg('country') && arg('state') && arg('city')
  ? { country_code: arg('country'), state_code: arg('state'), city_code: arg('city') }
  : null

if (!city) {
  const list = await siigoFetch('/v1/customers?page=1&page_size=1', { headers: authHeaders })
  const existing = list.body?.results?.[0]?.address?.city

  if (existing?.country_code && existing.state_code && existing.city_code) {
    city = {
      country_code: existing.country_code,
      state_code: existing.state_code,
      city_code: existing.city_code
    }
    console.log(`Ciudad tomada de un cliente existente: ${JSON.stringify(city)}`)
  } else {
    console.error('No se pudieron derivar códigos de ciudad de los clientes existentes.')
    console.error('Pásalos manualmente: --country MX --state <código> --city <código>')
    process.exit(1)
  }
}

const suffix = Math.random().toString(36).slice(2, 5).toUpperCase().padEnd(3, '0')
const payload = {
  person_type: 'Physical',
  rfc_id: `TEST010101${suffix}`,
  name: ['Prueba', `Smoke ${new Date().toISOString().slice(0, 16)}`],
  address: {
    address: 'Calle de prueba 1',
    city
  },
  contacts: { first_name: 'Prueba' }
}

console.log('\nPayload enviado a POST /v1/customers:')
console.log(JSON.stringify(payload, null, 2))

const created = await siigoFetch('/v1/customers', {
  method: 'POST',
  headers: authHeaders,
  body: JSON.stringify(payload)
})

console.log(`\nRespuesta (HTTP ${created.status}):`)
console.log(JSON.stringify(created.body, null, 2))

if (created.status >= 200 && created.status < 300) {
  console.log('\n✔ Cliente de prueba creado. Recuerda desactivarlo (active: false) en Siigo Nube.')
} else {
  console.error('\n✖ La creación falló; revisa el mensaje de Siigo arriba.')
  process.exit(1)
}
