/**
 * Integración con MacroDroid para alertas y automatizaciones en el teléfono móvil.
 * Permite a Milos enviar notificaciones sonoras de alta prioridad al celular del
 * operador (alertas de tienda, compras, caídas de red o confirmaciones).
 */

const STORAGE_KEY = 'milos_macrodroid_device_id'

export function getMacroDroidDeviceId(): string {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(STORAGE_KEY) || ''
    }
  } catch {}
  return ''
}

export function setMacroDroidDeviceId(id: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, id.trim())
    }
  } catch {}
}

/**
 * Dispara una macro o alerta en el teléfono del usuario vía webhook de MacroDroid.
 * Formato oficial: http://trigger.macrodroid.com/{device_id}/{action_name}
 */
export async function triggerMacroDroid(
  actionName: string,
  params: Record<string, string | number> = {},
): Promise<{ ok: boolean; message: string }> {
  const deviceId = getMacroDroidDeviceId()
  if (!deviceId) {
    return {
      ok: false,
      message: 'MacroDroid Device ID no configurado. Indique su ID de MacroDroid en configuración o dígaselo a Milos.',
    }
  }

  try {
    const cleanAction = encodeURIComponent(actionName.trim().replace(/\s+/g, '_'))
    const url = new URL(`https://trigger.macrodroid.com/${deviceId}/${cleanAction}`)
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, String(v))
    }

    const res = await fetch(url.toString(), {
      method: 'GET',
      signal: AbortSignal.timeout(6000),
    })

    if (res.ok) {
      return { ok: true, message: `Alerta "${actionName}" enviada con éxito al teléfono móvil.` }
    }
    return { ok: false, message: `MacroDroid respondió con código ${res.status}: ${res.statusText}` }
  } catch (err: any) {
    return { ok: false, message: `Error al contactar con MacroDroid: ${err.message}` }
  }
}
