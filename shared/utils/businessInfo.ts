export interface BusinessInfo {
  name: string
  legalName: string
  addressLines: string[]
  phone: string
  email: string
  rfc: string
  footerMessage: string
  businessHoursLines: string[]
  footerLines: string[]
}

// Datos tomados de la remisión física del negocio (remision.png).
export const BUSINESS_INFO: BusinessInfo = {
  name: 'Carolina Pinturas',
  legalName: 'Carolina Valenzuela Reyes',
  addressLines: [
    'Francisco Villa 2902 Col. Ejido Matamoros',
    'C.P. 22204 Tijuana, B.C.'
  ],
  phone: '(664) 549 0758',
  email: 'carolinapinturas@cvrtransportinc.com',
  rfc: 'VARC970809KW9',
  footerMessage: '¡Gracias por su compra!',
  businessHoursLines: [
    'Horario de atención:',
    'Lunes a Viernes de 8:00 AM a 5:00 PM',
    'Sábado de 8:00 AM a 1:00 PM'
  ],
  footerLines: [
    'No se hace devolución de efectivo'
  ]
}
