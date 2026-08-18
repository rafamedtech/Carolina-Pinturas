import { describe, expect, it } from 'vitest'
import { normalizeSiigoMexicoCityCode, siigoMexicoCityOptions } from '../../app/utils/siigoMexicoCities'
import { normalizeSiigoMexicoStateCode, SIIGO_MEXICO_STATES } from '../../app/utils/siigoMexicoStates'

describe('catálogo de ubicaciones de Siigo México', () => {
  it('incluye las 32 entidades y las 2,461 ciudades o municipios oficiales', () => {
    const cities = SIIGO_MEXICO_STATES.flatMap(state => siigoMexicoCityOptions(state.value))

    expect(SIIGO_MEXICO_STATES).toHaveLength(32)
    expect(cities).toHaveLength(2461)
    expect(siigoMexicoCityOptions('2')).toEqual([
      { value: '1', label: '1 · Ensenada' },
      { value: '2', label: '2 · Mexicali' },
      { value: '3', label: '3 · Tecate' },
      { value: '4', label: '4 · Tijuana' },
      { value: '5', label: '5 · Playas de Rosarito' }
    ])
  })

  it('normaliza ceros iniciales y rechaza combinaciones que no pertenecen al estado', () => {
    expect(normalizeSiigoMexicoStateCode('02')).toBe('2')
    expect(normalizeSiigoMexicoCityCode('2', '004')).toBe('4')
    expect(normalizeSiigoMexicoCityCode('2', '6')).toBe('')
  })
})
