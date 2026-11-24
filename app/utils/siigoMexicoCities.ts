import {
  getSiigoMexicoMunicipalities,
  isSiigoMexicoMunicipalityCode
} from '@rafamedtech/nuxt-shared/siigo-mexico-locations'

function catalogStateCode(stateCode: string) {
  return /^[1-9]\d?$/.test(stateCode) ? stateCode.padStart(2, '0') : ''
}

export function siigoMexicoCityOptions(stateCode: string) {
  return getSiigoMexicoMunicipalities(catalogStateCode(stateCode)).map(({ value: code, label }) => {
    const value = code.slice(2).replace(/^0+(?=\d)/, '')
    return { value, label: `${value} · ${label}` }
  })
}

export function normalizeSiigoMexicoCityCode(stateCode: string, cityCode: string | undefined) {
  const normalized = cityCode?.trim().replace(/^0+(?=\d)/, '') || ''
  const catalogState = catalogStateCode(stateCode)
  const catalogCity = catalogState + normalized.padStart(normalized.endsWith('*') ? 4 : 3, '0')

  return isSiigoMexicoMunicipalityCode(catalogState, catalogCity) ? normalized : ''
}
