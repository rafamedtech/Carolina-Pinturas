// Fuente: catálogo oficial "Países, estados y ciudades / municipios" de Siigo México.
export const SIIGO_MEXICO_STATES = [
  { value: '1', label: '1 · Aguascalientes' },
  { value: '2', label: '2 · Baja California' },
  { value: '3', label: '3 · Baja California Sur' },
  { value: '4', label: '4 · Campeche' },
  { value: '5', label: '5 · Coahuila de Zaragoza' },
  { value: '6', label: '6 · Colima' },
  { value: '7', label: '7 · Chiapas' },
  { value: '8', label: '8 · Chihuahua' },
  { value: '9', label: '9 · Ciudad de México' },
  { value: '10', label: '10 · Durango' },
  { value: '11', label: '11 · Guanajuato' },
  { value: '12', label: '12 · Guerrero' },
  { value: '13', label: '13 · Hidalgo' },
  { value: '14', label: '14 · Jalisco' },
  { value: '15', label: '15 · México' },
  { value: '16', label: '16 · Michoacán de Ocampo' },
  { value: '17', label: '17 · Morelos' },
  { value: '18', label: '18 · Nayarit' },
  { value: '19', label: '19 · Nuevo León' },
  { value: '20', label: '20 · Oaxaca' },
  { value: '21', label: '21 · Puebla' },
  { value: '22', label: '22 · Querétaro' },
  { value: '23', label: '23 · Quintana Roo' },
  { value: '24', label: '24 · San Luis Potosí' },
  { value: '25', label: '25 · Sinaloa' },
  { value: '26', label: '26 · Sonora' },
  { value: '27', label: '27 · Tabasco' },
  { value: '28', label: '28 · Tamaulipas' },
  { value: '29', label: '29 · Tlaxcala' },
  { value: '30', label: '30 · Veracruz de Ignacio de la Llave' },
  { value: '31', label: '31 · Yucatán' },
  { value: '32', label: '32 · Zacatecas' }
] satisfies Array<{ value: string, label: string }>

export function normalizeSiigoMexicoStateCode(value: string | undefined) {
  const normalized = value?.trim().replace(/^0+(?=\d)/, '') || ''
  return SIIGO_MEXICO_STATES.some(state => state.value === normalized) ? normalized : ''
}
