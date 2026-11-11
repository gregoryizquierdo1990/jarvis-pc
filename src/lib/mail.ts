/**
 * Cliente frontend para acceso al correo (vía bridge).
 */

const BRIDGE = () => (window as any).__BRIDGE_HTTP__ || 'http://localhost:8787'

export type MailMessage = {
  id: string
  from: string
  subject: string
  date: string
  preview?: string
  body?: string
}

export async function list(limit = 20): Promise<MailMessage[]> {
  const res = await fetch(BRIDGE() + `/mail/list?limit=${limit}`)
  if (!res.ok) throw new Error('No se pudo listar el correo')
  const data = await res.json()
  return data.messages || []
}

export async function read(id: string): Promise<MailMessage> {
  const res = await fetch(BRIDGE() + `/mail/read?id=${encodeURIComponent(id)}`)
  if (!res.ok) throw new Error('No se pudo leer el correo')
  return res.json()
}

export async function send(to: string, subject: string, body: string): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(BRIDGE() + '/mail/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to, subject, body }),
  })
  return res.json()
}
