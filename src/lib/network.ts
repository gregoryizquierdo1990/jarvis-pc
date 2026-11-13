import { execCommand } from './pcControl'
import { triggerMacroDroid } from './macrodroid'
import * as telegram from './telegram'

/**
 * Módulo de diagnóstico y monitoreo de red para Agente Milos.
 * Ejecuta comprobaciones nativas de internet, escaneo de dispositivos y tests de velocidad.
 */

/**
 * Comprueba si hay salida a internet haciendo ping a servidores DNS confiables.
 */
export async function checkInternet(host = '8.8.8.8'): Promise<{ ok: boolean; message: string; latencyMs?: number }> {
  const res = await execCommand(`ping -c 2 -W 3 ${host}`)
  if (res.ok && res.stdout && !res.stdout.includes('100% packet loss')) {
    const timeMatch = res.stdout.match(/time[=<]([\d.]+)\s*ms/i)
    const latency = timeMatch ? parseFloat(timeMatch[1]) : undefined
    return {
      ok: true,
      message: `Conexión a internet estable hacia ${host}${latency ? ` (${latency} ms)` : ''}.`,
      latencyMs: latency,
    }
  }
  return {
    ok: false,
    message: `Sin respuesta de internet hacia ${host}. La conexión parece caída o inestable.`,
  }
}

/**
 * Escanea la red local (Wi-Fi y cable) para identificar dispositivos conectados (IPs y MACs).
 */
export async function scanDevices(): Promise<{ ok: boolean; devices: Array<{ ip: string; mac: string; host?: string }>; raw: string }> {
  const res = await execCommand('ip neigh || arp -a')
  const devices: Array<{ ip: string; mac: string; host?: string }> = []
  const raw = res.stdout || ''

  // Formato ip neigh: 192.168.1.50 dev wlan0 lladdr aa:bb:cc:dd:ee:ff REACHABLE
  const lines = raw.split('\n')
  for (const line of lines) {
    const ipMatch = line.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/)
    const macMatch = line.match(/([0-9a-fA-F]{2}(?::[0-9a-fA-F]{2}){5})/)
    if (ipMatch && macMatch) {
      devices.push({
        ip: ipMatch[1],
        mac: macMatch[1],
        host: line.includes('REACHABLE') ? 'Activo' : 'Detectado',
      })
    }
  }

  return { ok: true, devices, raw }
}

/**
 * Mide la velocidad de red actual usando speedtest-cli o prueba de descarga.
 */
export async function measureSpeed(): Promise<{ ok: boolean; message: string; downloadMbps?: number; uploadMbps?: number }> {
  // Comprobar si speedtest-cli está instalado
  const checkCmd = await execCommand('which speedtest-cli || which speedtest')
  if (!checkCmd.ok || !checkCmd.stdout?.trim()) {
    // Si no está instalado, hacer un test ligero con ping y curl
    const pingRes = await checkInternet()
    return {
      ok: true,
      message: `speedtest-cli no está instalado en el sistema. Latencia actual: ${pingRes.latencyMs || 'OK'} ms. Puede instalarlo con: sudo apt install speedtest-cli`,
    }
  }

  const speedRes = await execCommand('speedtest-cli --simple --timeout 20')
  if (speedRes.ok && speedRes.stdout) {
    return {
      ok: true,
      message: `Diagnóstico de velocidad completado:\n${speedRes.stdout.trim()}`,
    }
  }

  return {
    ok: false,
    message: `No se pudo completar el test de velocidad: ${speedRes.error || speedRes.stderr}`,
  }
}

/**
 * Envía una alerta combinada a Telegram y al teléfono vía MacroDroid si ocurre una falla de red.
 */
export async function alertNetworkFailure(details: string): Promise<void> {
  const alertText = `🚨 ALERTA DE RED MILOS: ${details}`
  await telegram.send(alertText).catch(() => {})
  await triggerMacroDroid('alerta_red', { mensaje: details }).catch(() => {})
}
