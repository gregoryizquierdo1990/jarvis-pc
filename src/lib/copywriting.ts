// Módulo de Copywriting y Prompts de Venta de Alta Conversión para Agente Milos
// Soporta WhatsApp Estados, Grupos de Compra-Venta, Telegram y Banners Visuales.

export interface SalesCopyParams {
  producto: string
  precio: string
  modalidad_pago?: string
  categoria?: 'streaming' | 'comida' | 'confeccion' | 'recargas' | 'general'
  formato?: 'todos' | 'estado' | 'grupo'
  detalles_adicionales?: string
}

export interface SalesTemplate {
  id: string
  category: string
  title: string
  target: 'estado_whatsapp' | 'grupo_compra_venta' | 'telegram' | 'combo'
  structure: string
}

const TEMPLATES_KEY = 'milos_sales_templates'

export const DEFAULT_TEMPLATES: SalesTemplate[] = [
  {
    id: 'streaming-estado',
    category: 'streaming',
    title: 'Streaming Estado Viral (Gancho + Urgencia)',
    target: 'estado_whatsapp',
    structure: `🔥 ¡HOY SE MARATONEA! 🔥\nDisfruta de {producto} sin cortes y con activación inmediata 🍿✨\n💵 Solo {precio}\n📲 Pagos: {modalidad_pago}\n👇 ¡Responde este estado antes de que se agoten los cupos de hoy!`,
  },
  {
    id: 'streaming-grupo',
    category: 'streaming',
    title: 'Streaming Grupo Compra-Venta (Catálogo + Confianza)',
    target: 'grupo_compra_venta',
    structure: `🚀 ¡SUPER OFERTA EN STREAMING CON ENTREGA INMEDIATA! 🚀\nDisfruta de {producto} por solo {precio} 💯\n✓ Cuentas estables con garantía total del mes\n✓ Activación en 2 minutos\n💳 Pagos: {modalidad_pago}\n📲 Escríbenos al privado o entra a nuestro Telegram para ordenar ya.`,
  },
  {
    id: 'comida-menu',
    category: 'comida',
    title: 'Menú o Plato del Día',
    target: 'estado_whatsapp',
    structure: `🍽️ ¿SIN TIEMPO PARA COCINAR HOY? 🤤\nAlmuerzo del día: {producto} a solo {precio} 🍛\n🛵 Delivery activo / Pick-up disponible\nPagas con: {modalidad_pago}\n👉 Pide el tuyo antes de las 12:30 PM.`,
  },
  {
    id: 'recargas-saldo',
    category: 'recargas',
    title: 'Recargas Móviles y Pines al Instante',
    target: 'estado_whatsapp',
    structure: `📶 RECARGAS Y PINES AL INSTANTE ⚡\n¿Te quedaste sin saldo? Te recargamos en 2 minutos: Digitel, Movistar, SimpleTV, FreeFire.\n💵 Pagos: {modalidad_pago}\n📲 Envía tu número al privado y recarga ya.`,
  },
]

export function getSalesTemplates(): SalesTemplate[] {
  try {
    const raw = localStorage.getItem(TEMPLATES_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    }
  } catch {}
  return DEFAULT_TEMPLATES
}

export function saveSalesTemplate(template: SalesTemplate): { ok: boolean; message: string } {
  try {
    const current = getSalesTemplates()
    const index = current.findIndex((t) => t.id === template.id)
    if (index >= 0) {
      current[index] = template
    } else {
      current.push(template)
    }
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(current))
    return { ok: true, message: `Plantilla "${template.title}" guardada exitosamente.` }
  } catch (err: any) {
    return { ok: false, message: `Error al guardar plantilla: ${err?.message || err}` }
  }
}

export function populateTemplate(template: SalesTemplate, params: SalesCopyParams): string {
  let text = template.structure
  text = text.replace(/{producto}/g, params.producto)
  text = text.replace(/{precio}/g, params.precio)
  text = text.replace(
    /{modalidad_pago}/g,
    params.modalidad_pago || 'Pago Móvil 🇻🇪 | Binance USDT 🟡 | Zinli 💳 | Efectivo',
  )
  if (params.detalles_adicionales) {
    text += `\n\n📌 Nota adicional: ${params.detalles_adicionales}`
  }
  return text
}
