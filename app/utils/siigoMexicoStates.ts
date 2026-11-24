import {
  SIIGO_MEXICO_STATES as catalogStates,
  isSiigoMexicoStateCode
} from '@rafamedtech/nuxt-shared/siigo-mexico-locations'

export const SIIGO_MEXICO_STATES = catalogStates.map(({ value: code, label }) => {
  const value = String(Number(code))
  return { value, label: `${value} · ${label}` }
})

export function normalizeSiigoMexicoStateCode(value: string | undefined) {
  const normalized = value?.trim().replace(/^0+(?=\d)/, '') || ''
  return isSiigoMexicoStateCode(normalized.padStart(2, '0')) ? normalized : ''
}
