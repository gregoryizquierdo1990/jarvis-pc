/**
 * Control Nativo de PC para Agente Milos.
 * Conecta con el bridge local (Node.js) para controlar el sistema operativo,
 * abrir/cerrar apps, gestionar archivos, ejecutar comandos y gestionar energía.
 */

const BRIDGE_URL = 'http://localhost:8787'

async function postBridge(endpoint: string, data: Record<string, any>): Promise<any> {
  const url = `${BRIDGE_URL}${endpoint}`
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      signal: AbortSignal.timeout(45000),
    })
    return await res.json()
  } catch (err: any) {
    return { ok: false, error: `Bridge no disponible en ${BRIDGE_URL}: ${err.message}` }
  }
}

/**
 * Ejecuta un comando bash en la PC local.
 */
export async function execCommand(command: string, cwd?: string): Promise<{ ok: boolean; stdout?: string; stderr?: string; error?: string }> {
  return postBridge('/system/exec', { command, cwd })
}

/**
 * Abre una aplicación (ej. 'google-chrome', 'code', 'vlc', 'nautilus') o documento/archivo con xdg-open.
 */
export async function openAppOrFile(target: string): Promise<{ ok: boolean; message?: string; error?: string }> {
  return postBridge('/system/app', { action: 'open', target })
}

/**
 * Cierra una aplicación o proceso por su nombre (ej. 'chrome', 'spotify', 'vlc').
 */
export async function closeApp(target: string): Promise<{ ok: boolean; message?: string; error?: string }> {
  return postBridge('/system/app', { action: 'close', target })
}

/**
 * Control de energía: apagar, reiniciar o cerrar sesión.
 */
export async function powerControl(action: 'shutdown' | 'reboot' | 'logout'): Promise<{ ok: boolean; message?: string; error?: string }> {
  return postBridge('/system/power', { action })
}

/**
 * Operación sobre el sistema de archivos: leer, escribir, mover, copiar, eliminar, listar.
 */
export async function fileOperation(
  op: 'read' | 'write' | 'move' | 'copy' | 'delete' | 'list',
  path: string,
  dest?: string,
  content?: string,
): Promise<{ ok: boolean; [key: string]: any }> {
  return postBridge('/system/file-op', { op, path, dest, content })
}
