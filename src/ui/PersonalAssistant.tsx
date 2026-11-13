import { useEffect, useState } from 'react'
import * as memory from '../lib/memory'
import * as calendar from '../lib/calendar'
import * as files from '../lib/files'
import * as mail from '../lib/mail'
import * as telegram from '../lib/telegram'
import * as ingest from '../lib/ingest'
import * as repo from '../lib/repo'
import * as obsidian from '../lib/obsidian'
import * as n8n from '../lib/n8n'
import * as skills from '../lib/skillsCatalog'
import * as chatbots from '../lib/chatbots'
import * as subagents from '../lib/subagents'
import * as mcp from '../lib/mcp'
import * as agency from '../lib/agencyAgents'

type Tab =
  | 'memoria'
  | 'chatbots'
  | 'subagentes'
  | 'mcp'
  | 'n8n'
  | 'skills'
  | 'calendario'
  | 'archivos'
  | 'correo'
  | 'telegram'
  | 'ingesta'
  | 'repo'
  | 'notas'

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
          <span>M.I.L.O.S. — ASISTENTE PERSONAL & HERRAMIENTAS</span>
          <button onClick={() => setOpen(false)}>✕</button>
        </div>
        <div className="pa-tabs">
          {(
            [
              'memoria',
              'chatbots',
              'subagentes',
              'mcp',
              'n8n',
              'skills',
              'calendario',
              'archivos',
              'correo',
              'telegram',
              'ingesta',
              'repo',
              'notas',
            ] as Tab[]
          ).map((t) => (
            <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
              {t.toUpperCase()}
            </button>
          ))}
        </div>
        <div className="pa-body">
          {tab === 'memoria' && <MemoryTab />}
          {tab === 'chatbots' && <ChatbotsTab />}
          {tab === 'subagentes' && <SubagentsTab />}
          {tab === 'mcp' && <McpTab />}
          {tab === 'n8n' && <N8nTab />}
          {tab === 'skills' && <SkillsTab />}
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

function ChatbotsTab() {
  const [profiles, setProfiles] = useState<chatbots.ChatbotProfile[]>(chatbots.getChatbotProfiles())
  const [active, setActive] = useState<chatbots.ChatbotProfile>(chatbots.getActiveChatbot())
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [description, setDescription] = useState('')
  const [prompt, setPrompt] = useState('')
  const [status, setStatus] = useState('')

  const selectBot = (id: string) => {
    chatbots.setActiveChatbot(id)
    setActive(chatbots.getActiveChatbot())
    setStatus(`Modo activo: ${chatbots.getActiveChatbot().name}`)
  }

  const createBot = async () => {
    if (!name.trim() || !prompt.trim()) return
    const id = `custom-${Date.now().toString(36)}`
    const newProfile: chatbots.ChatbotProfile = {
      id,
      name: name.trim(),
      role: role.trim() || 'Asistente Personalizado',
      description: description.trim() || 'Chatbot personalizado por el usuario',
      systemPrompt: prompt.trim(),
      temperature: 0.7,
      allowedTools: ['all'],
    }
    await chatbots.saveChatbotProfile(newProfile)
    setProfiles(chatbots.getChatbotProfiles())
    selectBot(id)
    setName('')
    setRole('')
    setDescription('')
    setPrompt('')
    setStatus(`Chatbot creado: ${newProfile.name}`)
  }

  return (
    <div>
      <h4>Perfiles de Chatbot Activos</h4>
      <div className="pa-list">
        {profiles.map((p) => (
          <div
            key={p.id}
            className={`pa-item ${active.id === p.id ? 'active' : ''}`}
            style={{ cursor: 'pointer', borderLeft: active.id === p.id ? '3px solid #00e5ff' : 'none' }}
            onClick={() => selectBot(p.id)}
          >
            <div>
              <strong>{p.name}</strong> — <span className="dim">{p.role}</span>
              <p style={{ margin: '4px 0 0', fontSize: '0.85em', color: '#888' }}>{p.description}</p>
            </div>
            {active.id === p.id ? <span style={{ color: '#00e5ff' }}>✓ ACTIVO</span> : <span>Activar</span>}
          </div>
        ))}
      </div>

      <h4>Crear Nuevo Chatbot</h4>
      <div className="pa-row">
        <input style={{ flex: 1 }} value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre (ej. Milos Asesor Legal)" />
        <input style={{ flex: 1 }} value={role} onChange={(e) => setRole(e.target.value)} placeholder="Cargo / Función" />
      </div>
      <div className="pa-row">
        <input style={{ flex: 1 }} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descripción corta" />
      </div>
      <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="System Prompt e instrucciones especializadas…" rows={4} />
      <div className="pa-row">
        <button onClick={createBot}>Guardar y Activar Chatbot</button>
      </div>
      {status && <div className="pa-status">{status}</div>}
    </div>
  )
}

function SubagentsTab() {
  const [list] = useState<subagents.SubagentSpec[]>(subagents.listRecentSubagents())
  const [agencyList, setAgencyList] = useState<agency.AgencyAgent[]>(agency.searchAgencyAgents(''))
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedAgent, setSelectedAgent] = useState<agency.AgencyAgent | null>(null)
  const [taskPrompt, setTaskPrompt] = useState('')
  const [status, setStatus] = useState('')

  const handleSearch = (q: string) => {
    setSearchQuery(q)
    setAgencyList(agency.searchAgencyAgents(q))
  }

  return (
    <div>
      <h4>Subagentes Autónomos Activos / Recientes ({list.length})</h4>
      <p style={{ fontSize: '0.9em', color: '#aaa', margin: '4px 0 12px' }}>
        Milos genera y orquesta subagentes especializados para tareas complejas, asignándoles cargo, prompt y herramientas bajo su control.
      </p>
      <div className="pa-list" style={{ maxHeight: '180px', overflowY: 'auto', marginBottom: '20px' }}>
        {list.map((s) => (
          <div key={s.id} className="pa-item" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
              <strong>{s.name}</strong> <span style={{ color: s.status === 'completed' ? '#00ff88' : '#ffaa00' }}>[{s.status.toUpperCase()}]</span>
            </div>
            <div style={{ fontSize: '0.85em', color: '#00e5ff', margin: '2px 0' }}>Cargo: {s.role}</div>
            <div style={{ fontSize: '0.85em', color: '#ccc' }}>Misión: {s.task}</div>
            {s.result && (
              <pre className="pa-pre" style={{ marginTop: '6px', fontSize: '0.8em', width: '100%' }}>
                {s.result}
              </pre>
            )}
          </div>
        ))}
        {list.length === 0 && <div className="pa-status">(No hay subagentes generados recientemente. Pídele a Milos por voz o Telegram que invoque uno)</div>}
      </div>

      <hr style={{ borderColor: '#333', margin: '16px 0' }} />

      <h4>Catálogo de Roles de Élite (msitarzewski/agency-agents)</h4>
      <p style={{ fontSize: '0.88em', color: '#aaa', margin: '4px 0 10px' }}>
        Personalidades estructuradas de alto rendimiento que Milos puede consultar y desplegar como subagentes cuando desee.
      </p>

      <div className="pa-row">
        <input
          style={{ flex: 1 }}
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Buscar rol o habilidad (ej. backend, qa, security, finance, devops, marketing)…"
        />
      </div>

      <div className="pa-list" style={{ maxHeight: '220px', overflowY: 'auto' }}>
        {agencyList.map((a) => (
          <div
            key={a.id}
            className={`pa-item ${selectedAgent?.id === a.id ? 'active' : ''}`}
            style={{ cursor: 'pointer', flexDirection: 'column', alignItems: 'flex-start' }}
            onClick={() => setSelectedAgent(a)}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
              <span>
                <span style={{ marginRight: '6px' }}>{a.emoji || '🤖'}</span>
                <strong>{a.name}</strong>
              </span>
              <span className="dim">[{a.category.toUpperCase()}]</span>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '0.84em', color: '#bbb' }}>{a.description}</p>
            {a.deliverables && (
              <div style={{ fontSize: '0.78em', color: '#00e5ff', marginTop: '3px' }}>
                Entregables: {a.deliverables.join(' • ')}
              </div>
            )}
          </div>
        ))}
      </div>

      {selectedAgent && (
        <div style={{ marginTop: '16px', padding: '12px', border: '1px solid #333', borderRadius: '6px' }}>
          <h4>Asignar Misión a: {selectedAgent.emoji} {selectedAgent.name}</h4>
          <p style={{ fontSize: '0.85em', color: '#aaa', margin: '2px 0 8px' }}>{selectedAgent.vibe}</p>
          <div className="pa-row">
            <input
              style={{ flex: 1 }}
              value={taskPrompt}
              onChange={(e) => setTaskPrompt(e.target.value)}
              placeholder={`Describe la misión para ${selectedAgent.name}…`}
            />
            <button
              onClick={() => {
                if (!taskPrompt.trim()) return
                setStatus(`Subagente ${selectedAgent.name} invocado. Milos procesará la tarea.`)
                window.dispatchEvent(
                  new CustomEvent('jarvis:send-text', {
                    detail: `Milos, invoca a un subagente de agency-agents (${selectedAgent.name}) para la siguiente tarea: ${taskPrompt}`,
                  }),
                )
                setTaskPrompt('')
              }}
            >
              🚀 Desplegar Subagente
            </button>
          </div>
          {status && <div className="pa-status">{status}</div>}
        </div>
      )}
    </div>
  )
}

function N8nTab() {
  const [config, setConfig] = useState(n8n.getN8nConfig())
  const [urlInput, setUrlInput] = useState(config.url)
  const [apiKeyInput, setApiKeyInput] = useState(config.apiKey)
  const [status, setStatus] = useState('')
  const [workflows, setWorkflows] = useState<any[]>([])
  const [webhookPath, setWebhookPath] = useState('')
  const [webhookPayload, setWebhookPayload] = useState('{"origen": "milos"}')

  const testConn = async () => {
    setStatus('Probando conexión con n8n...')
    const res = await n8n.testConnection()
    setStatus(res.message)
  }

  const saveConfig = () => {
    n8n.setN8nConfig(urlInput.trim(), apiKeyInput.trim())
    setConfig(n8n.getN8nConfig())
    setStatus('Configuración de n8n guardada.')
  }

  const loadWorkflows = async () => {
    setStatus('Consultando flujos...')
    const res = await n8n.listWorkflows()
    if (res.ok && res.workflows) {
      setWorkflows(res.workflows)
      setStatus(`${res.workflows.length} flujos encontrados.`)
    } else {
      setStatus(`Error: ${res.error}`)
    }
  }

  const triggerHook = async () => {
    if (!webhookPath.trim()) return
    let payload = {}
    try { payload = JSON.parse(webhookPayload) } catch {}
    setStatus('Disparando webhook...')
    const res = await n8n.triggerWebhook(webhookPath.trim(), payload)
    setStatus(res.ok ? `Webhook ejecutado (HTTP ${res.status})` : `Error: ${res.error}`)
  }

  return (
    <div>
      <h4>Automatizaciones n8n (n8n-io/n8n)</h4>
      <div className="pa-row">
        <input style={{ flex: 2 }} value={urlInput} onChange={(e) => setUrlInput(e.target.value)} placeholder="URL de n8n (ej. http://localhost:5678)" />
        <input style={{ flex: 2 }} type="password" value={apiKeyInput} onChange={(e) => setApiKeyInput(e.target.value)} placeholder="API Key de n8n" />
        <button onClick={saveConfig}>Guardar</button>
        <button onClick={testConn}>Probar Conexión</button>
      </div>

      <h4>Disparar Webhook de n8n</h4>
      <div className="pa-row">
        <input style={{ flex: 2 }} value={webhookPath} onChange={(e) => setWebhookPath(e.target.value)} placeholder="Ruta o URL del Webhook (ej. mi-flujo)" />
        <input style={{ flex: 3 }} value={webhookPayload} onChange={(e) => setWebhookPayload(e.target.value)} placeholder='Payload JSON (ej. {"dato": 123})' />
        <button onClick={triggerHook}>Disparar</button>
      </div>

      <div className="pa-row" style={{ marginTop: '14px' }}>
        <button onClick={loadWorkflows}>Listar Flujos Existentes</button>
      </div>
      {workflows.length > 0 && (
        <div className="pa-list">
          {workflows.map((w) => (
            <div key={w.id} className="pa-item">
              <span><strong>{w.name}</strong></span>
              <span style={{ color: w.active ? '#00ff88' : '#888' }}>{w.active ? 'ACTIVO' : 'INACTIVO'}</span>
            </div>
          ))}
        </div>
      )}
      {status && <div className="pa-status">{status}</div>}
    </div>
  )
}

function SkillsTab() {
  const [list, setList] = useState<skills.Skill[]>(skills.listSkills())
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState<skills.Skill | null>(null)

  const search = (term: string) => {
    setQ(term)
    setList(term ? skills.searchSkills(term) : skills.listSkills())
  }

  return (
    <div>
      <h4>Catálogo de Habilidades (anthropics/skills)</h4>
      <div className="pa-row">
        <input style={{ flex: 1 }} value={q} onChange={(e) => search(e.target.value)} placeholder="Buscar habilidades disponibles…" />
      </div>
      <div className="pa-list">
        {list.map((s) => (
          <div
            key={s.name}
            className={`pa-item ${selected?.name === s.name ? 'active' : ''}`}
            style={{ cursor: 'pointer', flexDirection: 'column', alignItems: 'flex-start' }}
            onClick={() => setSelected(s)}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
              <strong>{s.name}</strong>
              <span className="dim">[{s.source}]</span>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '0.85em', color: '#aaa' }}>{s.description}</p>
          </div>
        ))}
      </div>
      {selected && (
        <div style={{ marginTop: '16px' }}>
          <h4>Instrucciones de la Habilidad: {selected.name}</h4>
          <pre className="pa-pre">{selected.instructions}</pre>
        </div>
      )}
    </div>
  )
}

function McpTab() {
  const [servers, setServers] = useState<mcp.McpServerConfig[]>(mcp.getMcpServers())
  const [newName, setNewName] = useState('')
  const [newUrl, setNewUrl] = useState('')
  const [newToken, setNewToken] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [testingId, setTestingId] = useState<string | null>(null)
  const [selectedServer, setSelectedServer] = useState<mcp.McpServerConfig | null>(null)
  const [statusMsg, setStatusMsg] = useState('')

  const refresh = () => {
    const list = mcp.getMcpServers()
    setServers(list)
    if (selectedServer) {
      setSelectedServer(list.find((s) => s.id === selectedServer.id) || null)
    }
  }

  const handleToggle = (id: string) => {
    mcp.toggleMcpServer(id)
    refresh()
  }

  const handleDelete = (id: string) => {
    if (confirm('¿Eliminar este servidor MCP?')) {
      mcp.deleteMcpServer(id)
      if (selectedServer?.id === id) setSelectedServer(null)
      refresh()
    }
  }

  const handleTest = async (id: string) => {
    setTestingId(id)
    setStatusMsg('Comprobando conexión MCP…')
    const res = await mcp.testMcpServer(id)
    setTestingId(null)
    setStatusMsg(res.message)
    refresh()
  }

  const handleAdd = () => {
    if (!newName.trim() || !newUrl.trim()) {
      setStatusMsg('Por favor ingresa nombre y URL del servidor MCP.')
      return
    }
    mcp.addMcpServer({
      name: newName.trim(),
      url: newUrl.trim(),
      bearerToken: newToken.trim() || undefined,
      description: newDesc.trim() || undefined,
      enabled: true,
      transport: 'http',
    })
    setNewName('')
    setNewUrl('')
    setNewToken('')
    setNewDesc('')
    setStatusMsg('Servidor MCP añadido exitosamente.')
    refresh()
  }

  return (
    <div>
      <h4>Model Context Protocol (MCP) — Conexión con Herramientas Diarias</h4>
      <p style={{ fontSize: '0.88em', color: '#aaa', margin: '4px 0 12px' }}>
        Conecta Milos con tus aplicaciones, servicios y terminal local mediante el estándar abierto MCP.
      </p>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
        <button
          onClick={() => {
            setNewName('Notion MCP')
            setNewUrl('https://mcp.notion.com/mcp')
            setNewDesc('Páginas, bases de datos y tareas en Notion.')
          }}
        >
          ➕ Plantilla Notion
        </button>
        <button
          onClick={() => {
            setNewName('GitHub Copilot / Repo MCP')
            setNewUrl('https://api.githubcopilot.com/mcp/')
            setNewDesc('Repositorios, issues y PRs en GitHub.')
          }}
        >
          ➕ Plantilla GitHub
        </button>
        <button
          onClick={() => {
            setNewName('Linear MCP')
            setNewUrl('https://mcp.linear.app/mcp')
            setNewDesc('Tareas, issues y sprints en Linear.')
          }}
        >
          ➕ Plantilla Linear
        </button>
        <button
          onClick={() => {
            setNewName('Home Assistant MCP')
            setNewUrl('http://homeassistant.local:8123/api/mcp')
            setNewDesc('Control de domótica, luces y sensores.')
          }}
        >
          ➕ Plantilla Domótica
        </button>
        <button
          onClick={() => {
            setNewName('Zapier MCP')
            setNewUrl('https://mcp.zapier.com/mcp')
            setNewDesc('Conexión con 6,000+ apps vía Zapier.')
          }}
        >
          ➕ Plantilla Zapier
        </button>
      </div>

      <div className="pa-row">
        <input style={{ flex: 2 }} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nombre del servidor (ej. Notion MCP)" />
        <input style={{ flex: 3 }} value={newUrl} onChange={(e) => setNewUrl(e.target.value)} placeholder="URL endpoint MCP (ej. http://localhost:8765/mcp)" />
        <input style={{ flex: 2 }} type="password" value={newToken} onChange={(e) => setNewToken(e.target.value)} placeholder="Token / API Key opcional" />
        <input style={{ flex: 2 }} value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Descripción" />
        <button onClick={handleAdd}>Añadir MCP</button>
      </div>

      {statusMsg && <div className="pa-status">{statusMsg}</div>}

      <div className="pa-list" style={{ marginTop: '16px' }}>
        {servers.map((s) => (
          <div
            key={s.id}
            className={`pa-item ${selectedServer?.id === s.id ? 'active' : ''}`}
            style={{ flexDirection: 'column', alignItems: 'stretch' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong>{s.name}</strong>
                <span
                  style={{
                    marginLeft: '8px',
                    fontSize: '0.8em',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    backgroundColor: s.status === 'online' ? '#00ff8822' : s.status === 'offline' ? '#ff444422' : '#ffaa0022',
                    color: s.status === 'online' ? '#00ff88' : s.status === 'offline' ? '#ff6666' : '#ffaa00',
                  }}
                >
                  {s.status === 'online' ? 'EN LÍNEA' : s.status === 'offline' ? 'SIN CONEXIÓN' : 'NO PROBADO'}
                </span>
                <span style={{ marginLeft: '8px', fontSize: '0.8em', color: '#888' }}>
                  ({s.tools?.length || 0} herramientas)
                </span>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={() => handleToggle(s.id)}>
                  {s.enabled ? '🟢 Habilitado' : '⚪ Deshabilitado'}
                </button>
                <button disabled={testingId === s.id} onClick={() => handleTest(s.id)}>
                  {testingId === s.id ? 'Probando…' : 'Probar'}
                </button>
                <button onClick={() => setSelectedServer(selectedServer?.id === s.id ? null : s)}>
                  {selectedServer?.id === s.id ? 'Ocultar' : 'Ver Tools'}
                </button>
                <button style={{ color: '#ff6666' }} onClick={() => handleDelete(s.id)}>
                  ✕
                </button>
              </div>
            </div>
            <div style={{ fontSize: '0.82em', color: '#888', marginTop: '4px' }}>
              Endpoint: <code>{s.url}</code>
              {s.description && ` — ${s.description}`}
            </div>
          </div>
        ))}
      </div>

      {selectedServer && (
        <div style={{ marginTop: '18px', padding: '12px', border: '1px solid #333', borderRadius: '6px' }}>
          <h4>Herramientas de: {selectedServer.name}</h4>
          {(!selectedServer.tools || selectedServer.tools.length === 0) ? (
            <p className="dim">No hay herramientas registradas para este servidor aún. Presiona "Probar" para sincronizar.</p>
          ) : (
            <div className="pa-list">
              {selectedServer.tools.map((t) => (
                <div key={t.name} className="pa-item" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                    <strong style={{ color: '#00ffff' }}>{t.name}</strong>
                  </div>
                  <p style={{ margin: '4px 0 0', fontSize: '0.85em', color: '#ccc' }}>
                    {t.description || 'Sin descripción'}
                  </p>
                  {t.inputSchema?.properties && (
                    <div style={{ fontSize: '0.78em', color: '#888', marginTop: '4px' }}>
                      Parámetros: {Object.keys(t.inputSchema.properties).join(', ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

