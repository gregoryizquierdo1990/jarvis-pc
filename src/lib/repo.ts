/**
 * Cliente frontend para control del repositorio git (vía bridge).
 * Permite leer, modificar, commit y push sobre el repo configurado en el bridge.
 */

const BRIDGE = () => (window as any).__BRIDGE_HTTP__ || 'http://localhost:8787'

export async function root(): Promise<{ root: string; configured: boolean }> {
  const res = await fetch(BRIDGE() + '/repo/root')
  const d = await res.json()
  if (d.error) throw new Error(d.error)
  return { root: d.root || '', configured: Boolean(d.configured) }
}

export async function status(): Promise<string> {
  const res = await fetch(BRIDGE() + '/repo/status')
  const d = await res.json()
  if (d.error) throw new Error(d.error)
  return d.status || ''
}

export async function diff(path?: string): Promise<string> {
  const res = await fetch(BRIDGE() + '/repo/diff' + (path ? `?path=${encodeURIComponent(path)}` : ''))
  const d = await res.json()
  if (d.error) throw new Error(d.error)
  return d.diff || ''
}

export async function log(limit = 10): Promise<string> {
  const res = await fetch(BRIDGE() + `/repo/log?limit=${limit}`)
  const d = await res.json()
  if (d.error) throw new Error(d.error)
  return d.log || ''
}

export async function listFiles(sub = ''): Promise<string[]> {
  const res = await fetch(BRIDGE() + '/repo/list?path=' + encodeURIComponent(sub))
  const d = await res.json()
  if (d.error) throw new Error(d.error)
  return d.files || []
}

export async function readFile(path: string): Promise<string> {
  const res = await fetch(BRIDGE() + '/repo/read?path=' + encodeURIComponent(path))
  const d = await res.json()
  if (d.error) throw new Error(d.error)
  return d.content || ''
}

export async function show(target = 'HEAD'): Promise<string> {
  const res = await fetch(BRIDGE() + '/repo/show?target=' + encodeURIComponent(target))
  const d = await res.json()
  if (d.error) throw new Error(d.error)
  return d.show || ''
}

export async function writeFile(path: string, content: string): Promise<void> {
  const res = await fetch(BRIDGE() + '/repo/write', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, content }),
  })
  const d = await res.json()
  if (d.error) throw new Error(d.error)
}

export async function commit(message: string, addAll = true): Promise<void> {
  const res = await fetch(BRIDGE() + '/repo/commit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, addAll }),
  })
  const d = await res.json()
  if (d.error) throw new Error(d.error)
}

export async function push(): Promise<void> {
  const res = await fetch(BRIDGE() + '/repo/push', { method: 'POST' })
  const d = await res.json()
  if (d.error) throw new Error(d.error)
}

export async function pull(): Promise<void> {
  const res = await fetch(BRIDGE() + '/repo/pull', { method: 'POST' })
  const d = await res.json()
  if (d.error) throw new Error(d.error)
}

export async function createBranch(name: string): Promise<void> {
  const res = await fetch(BRIDGE() + '/repo/branch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  const d = await res.json()
  if (d.error) throw new Error(d.error)
}
