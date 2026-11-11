import { useEffect, useState } from 'react'
import * as memory from '../lib/memory'
import * as calendar from '../lib/calendar'
import * as files from '../lib/files'
import * as mail from '../lib/mail'
import * as telegram from '../lib/telegram'
import * as ingest from '../lib/ingest'
import * as repo from '../lib/repo'
import * as obsidian from '../lib/obsidian'

type Tab = 'memoria' | 'calendario' | 'archivos' | 'correo' | 'telegram' | 'ingesta' | 'repo' | 'notas'

export function PersonalAssistant() {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<Tab>('memoria')

  useEffect(() => {
    const handler = () => setOpen((o) => !o)
    window.addEventListener('jarvis:toggle-pa', handler)
    return () => window.removeEventListener('jarvis:toggle-pa', handler)
  }, [])

  if (!open) return null

  return (
    <div className="pa-overlay">
      <div className="pa-panel">
        <div className="pa-header">
          <span>ASISTENTE PERSONAL — MEMORIA & HERRAMIENTAS</span>
          <button onClick={() => setOpen(false)}>✕</button>
        </div>
        <div className="pa-tabs">
          {(['memoria', 'calendario', 'archivos', 'correo', 'telegram', 'ingesta', 'repo', 'notas'] as Tab[]).map((t) => (
            <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
              {t.toUpperCase()}
            </button>
          ))}
        </div>
        <div className="pa-body">
          {tab === 'memoria' && <MemoryTab />}
          {tab === 'calendario' && <CalendarTab />}
          {tab === 'archivos' && <FilesTab />}
          {tab === 'correo' && <MailTab />}
          {tab === 'telegram' && <TelegramTab />}
          {tab === 'ingesta' && <IngestTab />}
          {tab === 'repo' && <RepoTab />}
          {tab === 'notas' && <NotesTab />}
        </div>
      </div>
    </div>
  )
}

function MemoryTab() {
  const [facts, setFacts] = useState<memory.Fact[]>([])
  const [key, setKey] = useState('')
  const [value, setValue] = useState('')
  const [q, setQ] = useState('')
  async function refresh() {
    setFacts(q ? await memory.searchFacts(q) : await memory.listFacts())
  }
  useEffect(() => { refresh() }, [q])
  return (
    <div>
      <div className="pa-row">
        <input placeholder="Clave" value={key} onChange={(e) => setKey(e.target.value)} />
        <input placeholder="Valor" value={value} onChange={(e) => setValue(e.target.value)} />
        <button onClick={async () => { if (key && value) { await memory.remember({ key, value }); setKey(''); setValue(''); refresh() } }}>
          Guardar
        </button>
      </div>
      <input className="pa-search" placeholder="Buscar en memoria..." value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="pa-list">
        {facts.map((f) => (
          <div key={f.id} className="pa-item">
            <b>[{f.kind}] {f.key}</b>: {f.value}
            <button onClick={async () => { await memory.forget(f.id); refresh() }}>✕</button>
          </div>
        ))}
      </div>
    </div>
  )
}

function CalendarTab() {
  const [events, setEvents] = useState<calendar.CalEvent[]>([])
  const [title, setTitle] = useState('')
  const [start, setStart] = useState('')
  const [desc, setDesc] = useState('')
  async function refresh() { setEvents(await calendar.upcoming(30)) }
  useEffect(() => { refresh() }, [])
  return (
    <div>
      <div className="pa-row">
        <input placeholder="Título" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
        <input placeholder="Descripción" value={desc} onChange={(e) => setDesc(e.target.value)} />
        <button onClick={async () => {
          if (title && start) {
            await calendar.addEvent({ title, start: new Date(start).getTime(), description: desc })
            setTitle(''); setStart(''); setDesc(''); refresh()
          }
        }}>Agendar</button>
      </div>
      <div className="pa-list">
        {events.map((e) => (
          <div key={e.id} className="pa-item">
            {calendar.formatEvent(e)}
            <button onClick={async () => { await calendar.deleteEvent(e.id); refresh() }}>✕</button>
          </div>
        ))}
      </div>
    </div>
  )
}

function FilesTab() {
  const [q, setQ] = useState('')
  const [root, setRoot] = useState('')
  const [hits, setHits] = useState<files.FileHit[]>([])
  const [loading, setLoading] = useState(false)
  async function run() {
    setLoading(true)
    try { setHits(await files.search(q, root || undefined)) } catch (e: any) { setHits([]) }
    setLoading(false)
  }
  return (
    <div>
      <div className="pa-row">
        <input placeholder="Buscar..." value={q} onChange={(e) => setQ(e.target.value)} />
        <input placeholder="Directorio raíz (opcional)" value={root} onChange={(e) => setRoot(e.target.value)} />
        <button onClick={run} disabled={loading}>{loading ? '...' : 'Buscar'}</button>
      </div>
      <div className="pa-list">
        {hits.map((h, i) => (
          <div key={i} className="pa-item">
            <b>{h.name}</b> — {h.path}
            {h.snippet && <div className="pa-snippet">{h.snippet}</div>}
          </div>
        ))}
      </div>
    </div>
  )
}

function MailTab() {
  const [msgs, setMsgs] = useState<mail.MailMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [to, setTo] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  async function refresh() {
    setLoading(true)
    try { setMsgs(await mail.list(20)) } catch { setMsgs([]) }
    setLoading(false)
  }
  useEffect(() => { refresh() }, [])
  return (
    <div>
      <button onClick={refresh}>{loading ? 'Cargando...' : 'Actualizar bandeja'}</button>
      <div className="pa-list">
        {msgs.map((m) => (
          <div key={m.id} className="pa-item">
            <b>{m.subject}</b> — {m.from} ({m.date})
          </div>
        ))}
      </div>
      <h4>Enviar correo</h4>
      <div className="pa-row">
        <input placeholder="Para" value={to} onChange={(e) => setTo(e.target.value)} />
        <input placeholder="Asunto" value={subject} onChange={(e) => setSubject(e.target.value)} />
      </div>
      <textarea placeholder="Cuerpo" value={body} onChange={(e) => setBody(e.target.value)} />
      <button onClick={async () => {
        if (to && subject) { await mail.send(to, subject, body); setTo(''); setSubject(''); setBody('') }
      }}>Enviar</button>
    </div>
  )
}

function TelegramTab() {
  const [token, setToken] = useState(telegram.getConfig().botToken || '')
  const [chatId, setChatId] = useState(telegram.getConfig().chatId || '')
  const [text, setText] = useState('')
  const [status, setStatus] = useState('')
  return (
    <div>
      <div className="pa-row">
        <input placeholder="Bot Token" value={token} onChange={(e) => setToken(e.target.value)} />
        <input placeholder="Chat ID" value={chatId} onChange={(e) => setChatId(e.target.value)} />
        <button onClick={() => { telegram.setConfig({ botToken: token, chatId }); setStatus('Guardado') }}>Guardar</button>
      </div>
      <div className="pa-row">
        <input placeholder="Mensaje de aviso" value={text} onChange={(e) => setText(e.target.value)} />
        <button onClick={async () => {
          const r = await telegram.send(text)
          setStatus(r.ok ? 'Enviado' : (r.error || 'Error'))
          if (r.ok) setText('')
        }}>Enviar aviso</button>
      </div>
      {status && <div className="pa-status">{status}</div>}
    </div>
  )
}

function RepoTab() {
  const [status, setStatus] = useState('')
  const [log, setLog] = useState('')
  const [files, setFiles] = useState<string[]>([])
  const [selected, setSelected] = useState('')
  const [content, setContent] = useState('')
  const [msg, setMsg] = useState('Actualización desde Agente Milos')
  const [out, setOut] = useState('')
  const [root, setRoot] = useState('')
  const [configured, setConfigured] = useState(false)
  async function refresh() {
    try {
      const r = await repo.root()
      setRoot(r.root)
      setConfigured(r.configured)
      setStatus(await repo.status())
      setLog(await repo.log(10))
      setFiles(await repo.listFiles(''))
    } catch (e: any) { setOut('Error: ' + (e?.message || e)) }
  }
  useEffect(() => { refresh() }, [])
  async function openFile(p: string) {
    setSelected(p)
    try { setContent(await repo.readFile(p)) } catch (e: any) { setContent('Error: ' + e.message) }
  }
  return (
    <div>
      <button onClick={refresh}>Actualizar estado</button>
      <h4>Repositorio controlado {configured ? '' : '(por defecto: proyecto jarvis)'}</h4>
      <pre className="pa-pre">{root || '(sin datos)'}</pre>
      <h4>Estado</h4>
      <pre className="pa-pre">{status || '(sin datos)'}</pre>
      <h4>Últimos commits</h4>
      <pre className="pa-pre">{log || '(sin datos)'}</pre>
      <h4>Archivos</h4>
      <div className="pa-list">
        {files.slice(0, 200).map((f) => (
          <div key={f} className="pa-item" style={{ cursor: 'pointer' }} onClick={() => openFile(f)}>
            {f}
          </div>
        ))}
      </div>
      {selected && (
        <>
          <h4>Archivo: {selected}</h4>
          <textarea style={{ width: '100%', minHeight: 200 }} value={content} onChange={(e) => setContent(e.target.value)} />
          <button onClick={async () => { try { await repo.writeFile(selected, content); setOut('Guardado: ' + selected) } catch (e: any) { setOut('Error: ' + e.message) } }}>Guardar</button>
        </>
      )}
      <h4>Commit & push</h4>
      <div className="pa-row">
        <input style={{ flex: 1 }} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Mensaje del commit" />
        <button onClick={async () => { try { await repo.commit(msg); setOut('Commit: ' + msg) } catch (e: any) { setOut('Error: ' + e.message) } }}>Commit</button>
        <button onClick={async () => { try { await repo.push(); setOut('Push OK') } catch (e: any) { setOut('Error: ' + e.message) } }}>Push</button>
        <button onClick={async () => { try { await repo.pull(); setOut('Pull OK') } catch (e: any) { setOut('Error: ' + e.message) } }}>Pull</button>
      </div>
      {out && <div className="pa-status">{out}</div>}
    </div>
  )
}

function IngestTab() {
  const [text, setText] = useState('')
  const [url, setUrl] = useState('')
  const [status, setStatus] = useState('')
  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setStatus('Procesando...')
    try {
      const r = await ingest.ingestFile(file)
      setStatus(`Ingerido: ${r.title} (${r.storedFacts} hechos)`)
    } catch (err: any) {
      setStatus('Error: ' + (err?.message || err))
    }
  }
  return (
    <div>
      <h4>Ingerir texto</h4>
      <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Pega texto, reglas, precios, nombres..." />
      <button onClick={async () => {
        if (text.trim()) {
          const r = await ingest.ingestText(text)
          setStatus(`Ingerido: ${r.storedFacts} hechos`)
          setText('')
        }
      }}>Guardar en memoria</button>

      <h4>Ingerir URL</h4>
      <div className="pa-row">
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." />
        <button onClick={async () => {
          if (url.trim()) {
            setStatus('Leyendo URL...')
            try {
              const r = await ingest.ingestUrl(url)
              setStatus(`Ingerido: ${r.title} (${r.storedFacts} hechos)`)
              setUrl('')
            } catch (err: any) {
              setStatus('Error: ' + (err?.message || err))
            }
          }
        }}>Leer y memorizar</button>
      </div>

      <h4>Subir archivo (PDF, imagen, ZIP, RAR, TXT)</h4>
      <input type="file" onChange={handleFile} />

      <h4>Datos estructurados</h4>
      <button onClick={async () => {
        const n = await ingest.ingestStructured({
          rules: ['Descuento del 10% a clientes recurrentes', 'Envío gratis sobre $50'],
          prices: [{ item: 'Café', price: 3.5, currency: 'USD' }],
        })
        setStatus(`Guardados ${n} datos de ejemplo`)
      }}>Cargar ejemplo</button>

      {status && <div className="pa-status">{status}</div>}
    </div>
  )
}

function NotesTab() {
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<Array<{ path: string; snippet: string }>>([])
  const [files, setFiles] = useState<string[]>([])
  const [selected, setSelected] = useState('')
  const [content, setContent] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [newBody, setNewBody] = useState('')
  const [out, setOut] = useState('')
  const [rootPath, setRootPath] = useState('')

  async function refresh() {
    try {
      setRootPath(await obsidian.root())
      setFiles(await obsidian.listNotes(''))
    } catch (e: any) { setOut('Error: ' + (e?.message || e)) }
  }
  useEffect(() => { refresh() }, [])

  async function runSearch() {
    if (!search.trim()) return
    try {
      setResults(await obsidian.searchNotes(search))
      setOut('')
    } catch (e: any) { setOut('Error: ' + e.message) }
  }

  async function openNote(p: string) {
    setSelected(p)
    try { setContent(await obsidian.readNote(p)) } catch (e: any) { setContent('Error: ' + e.message) }
  }

  async function createNote() {
    if (!newTitle.trim()) return
    try {
      const path = `Milos/Notas/${obsidian.slug(newTitle)}.md`
      await obsidian.writeNote(path, `# ${newTitle}\n\n${newBody}\n`)
      setOut('Nota creada: ' + path)
      setNewTitle(''); setNewBody('')
      refresh()
    } catch (e: any) { setOut('Error: ' + e.message) }
  }

  const shown = search.trim() ? results.map((r) => r.path) : files
  return (
    <div>
      <button onClick={refresh}>Actualizar</button>
      <h4>Bóveda: {rootPath || '…'}</h4>
      <div className="pa-row">
        <input
          className="pa-search"
          style={{ flex: 1 }}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') runSearch() }}
          placeholder="Buscar en todas las notas… (Enter)"
        />
        <button onClick={runSearch}>Buscar</button>
      </div>
      <h4>Notas ({shown.length})</h4>
      <div className="pa-list">
        {shown.slice(0, 300).map((p) => (
          <div key={p} className="pa-item" style={{ cursor: 'pointer' }} onClick={() => openNote(p)}>
            <span>{p}</span>
          </div>
        ))}
        {shown.length === 0 && <div className="pa-status">(sin notas todavía)</div>}
      </div>
      {selected && (
        <>
          <h4>{selected}</h4>
          <pre className="pa-pre">{content || '(vacía)'}</pre>
          <button onClick={async () => {
            try {
              await obsidian.deleteNote(selected)
              setOut('Nota eliminada: ' + selected)
              setSelected(''); setContent('')
              refresh()
            } catch (e: any) { setOut('Error: ' + e.message) }
          }}>Eliminar nota</button>
        </>
      )}
      <h4>Nueva nota</h4>
      <div className="pa-row">
        <input style={{ flex: 1 }} value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Título de la nota" />
      </div>
      <textarea value={newBody} onChange={(e) => setNewBody(e.target.value)} placeholder="Contenido Markdown…" />
      <div className="pa-row">
        <button onClick={createNote}>Crear nota</button>
      </div>
      {out && <div className="pa-status">{out}</div>}
    </div>
  )
}
