import { SYSTEM_PROMPT } from '../config'
import * as camera from './camera'
import * as memory from './memory'
import * as calendar from './calendar'
import * as telegram from './telegram'
import * as mail from './mail'
import * as files from './files'
import * as ingest from './ingest'
import * as journal from './journal'
import * as calc from './calculator'
import * as gen from './generate'
import * as tr from './translate'
import * as units from './units'
import * as repo from './repo'
import * as obsidian from './obsidian'
import * as api from './geminiApi'

export type AskHandlers = {
  onText: (delta: string) => void
  onTool: (name: string) => void
}

export type GeminiMsg = {
  role: 'user' | 'assistant' | 'model'
  content?: string
  text?: string
}

let activeAbort: AbortController | null = null

export function cancel(): void {
  if (activeAbort) {
    activeAbort.abort()
    activeAbort = null
  }
}

export function connectedLabels(): string[] {
  return ['Google Gemini', 'Memoria', 'Calendario', 'Archivos', 'Correo', 'Telegram', 'Visión']
}

// ---------- Tool definitions (Gemini function calling) ----------

const toolDeclarations = [
  {
    name: 'remember_fact',
    description:
      'Guarda un hecho, preferencia, regla, contacto, producto o precio en la memoria persistente del asistente (también se espeja automáticamente en la bóveda de Obsidian). Úsalo cuando el usuario te dé información sobre su negocio, preferencias, reglas, nombres, precios o datos que deban recordarse.',
    parameters: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Clave corta identificadora (ej. "precio:cafe", "regla:descuento").' },
        value: { type: 'string', description: 'Valor o descripción completa.' },
        kind: {
          type: 'string',
          enum: ['fact', 'preference', 'rule', 'contact', 'product', 'price', 'note'],
          description: 'Tipo de hecho.',
        },
        tags: { type: 'array', items: { type: 'string' }, description: 'Etiquetas opcionales.' },
      },
      required: ['key', 'value'],
    },
  },
  {
    name: 'recall_facts',
    description: 'Busca en la memoria hechos relevantes para una consulta.',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string' } },
      required: ['query'],
    },
  },
  {
    name: 'forget_fact',
    description: 'Olvida un hecho por su clave.',
    parameters: {
      type: 'object',
      properties: { key: { type: 'string' } },
      required: ['key'],
    },
  },
  {
    name: 'schedule_event',
    description: 'Crea un evento en el calendario. start en ISO 8601 o timestamp ms.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        start: { type: 'string', description: 'Fecha/hora ISO 8601 (ej. 2026-11-12T10:00:00) o ms epoch.' },
        description: { type: 'string' },
        reminderMinutes: { type: 'number', description: 'Minutos antes para recordatorio.' },
      },
      required: ['title', 'start'],
    },
  },
  {
    name: 'list_events',
    description: 'Lista eventos próximos del calendario.',
    parameters: {
      type: 'object',
      properties: { days: { type: 'number', description: 'Días hacia adelante (default 7).' } },
    },
  },
  {
    name: 'delete_event',
    description: 'Elimina un evento por id.',
    parameters: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
    },
  },
  {
    name: 'search_files',
    description: 'Busca archivos en la PC del usuario por nombre o contenido.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        root: { type: 'string', description: 'Directorio raíz opcional.' },
        max: { type: 'number' },
      },
      required: ['query'],
    },
  },
  {
    name: 'read_file',
    description: 'Lee el contenido de un archivo local.',
    parameters: {
      type: 'object',
      properties: { path: { type: 'string' } },
      required: ['path'],
    },
  },
  {
    name: 'send_telegram',
    description: 'Envía un aviso/mensaje por Telegram.',
    parameters: {
      type: 'object',
      properties: {
        text: { type: 'string' },
        chatId: { type: 'string', description: 'Chat id opcional (usa el configurado por defecto).' },
      },
      required: ['text'],
    },
  },
  {
    name: 'list_mail',
    description: 'Lista los últimos correos del buzón.',
    parameters: {
      type: 'object',
      properties: { limit: { type: 'number' } },
    },
  },
  {
    name: 'read_mail',
    description: 'Lee un correo por id.',
    parameters: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
    },
  },
  {
    name: 'send_mail',
    description: 'Envía un correo electrónico.',
    parameters: {
      type: 'object',
      properties: {
        to: { type: 'string' },
        subject: { type: 'string' },
        body: { type: 'string' },
      },
      required: ['to', 'subject', 'body'],
    },
  },
  {
    name: 'ingest_url',
    description: 'Lee y memoriza el contenido de una URL.',
    parameters: {
      type: 'object',
      properties: { url: { type: 'string' } },
      required: ['url'],
    },
  },
  {
    name: 'look_camera',
    description: 'Mira a través de la cámara para ver qué hay delante.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'calculate',
    description: 'Calcula una expresión matemática. Soporta +,-,*,/,(),%, y funciones Math (sqrt, pow, round, etc.).',
    parameters: { type: 'object', properties: { expression: { type: 'string' } }, required: ['expression'] },
  },
  {
    name: 'recipe_cost',
    description:
      'Calcula costo de producción de una receta: ingredientes, merma, rendimiento, costo unitario y precio sugerido con margen.',
    parameters: {
      type: 'object',
      properties: {
        ingredientes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              nombre: { type: 'string' },
              cantidad: { type: 'number' },
              unidad: { type: 'string' },
              costoUnitario: { type: 'number' },
            },
            required: ['nombre', 'cantidad', 'unidad', 'costoUnitario'],
          },
        },
        mermaPct: { type: 'number', description: 'Porcentaje de merma.' },
        rendimiento: { type: 'number', description: 'Unidades producidas.' },
        margenPct: { type: 'number', description: 'Margen deseado % sobre costo.' },
      },
      required: ['ingredientes', 'rendimiento'],
    },
  },
  {
    name: 'margin_calc',
    description: 'Calcula margen bruto, % de margen y markup a partir de precio de venta y costo.',
    parameters: {
      type: 'object',
      properties: { precioVenta: { type: 'number' }, costo: { type: 'number' } },
      required: ['precioVenta', 'costo'],
    },
  },
  {
    name: 'break_even',
    description: 'Calcula punto de equilibrio (unidades y ventas) a partir de costos fijos, precio unitario y costo variable unitario.',
    parameters: {
      type: 'object',
      properties: {
        costosFijos: { type: 'number' },
        precioUnitario: { type: 'number' },
        costoVariableUnitario: { type: 'number' },
      },
      required: ['costosFijos', 'precioUnitario', 'costoVariableUnitario'],
    },
  },
  {
    name: 'waste_calc',
    description: 'Calcula merma/perdida y cantidad aprovechable de una producción.',
    parameters: {
      type: 'object',
      properties: {
        produccion: { type: 'number' },
        mermaPct: { type: 'number' },
        unidad: { type: 'string' },
      },
      required: ['produccion', 'mermaPct'],
    },
  },
  {
    name: 'log_journal',
    description:
      'Registra en la bitácora del día lo aprendido, decisiones tomadas, métricas y resumen (se espeja en Milos/Bitacora/YYYY-MM-DD.md de la bóveda). Úsalo al final de una interacción importante o cuando el usuario pida resumen del día.',
    parameters: {
      type: 'object',
      properties: {
        summary: { type: 'string' },
        learned: { type: 'array', items: { type: 'string' } },
        decisions: { type: 'array', items: { type: 'string' } },
        metrics: { type: 'object', description: 'Métricas numéricas clave (ej. {ventas: 1200, mermas: 5}).' },
        mood: { type: 'string', enum: ['positive', 'neutral', 'concern'] },
      },
      required: ['summary'],
    },
  },
  {
    name: 'get_journal',
    description: 'Obtiene las entradas recientes de la bitácora diaria.',
    parameters: { type: 'object', properties: { days: { type: 'number' } } },
  },
  {
    name: 'set_business_profile',
    description: 'Guarda o actualiza datos del perfil del negocio (nombre, giro, moneda, impuesto, etc.).',
    parameters: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Ej. negocio.nombre, moneda, impuesto_pct, giro.' },
        value: { type: 'string' },
      },
      required: ['key', 'value'],
    },
  },
  {
    name: 'daily_briefing',
    description: 'Genera un resumen proactivo del día: memoria relevante, eventos próximos, bitácora reciente y sugerencias.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'generate_text_file',
    description: 'Genera y descarga un archivo de texto (.txt o .md).',
    parameters: { type: 'object', properties: { name: { type: 'string' }, content: { type: 'string' }, markdown: { type: 'boolean' } }, required: ['name', 'content'] },
  },
  {
    name: 'generate_docx',
    description: 'Genera y descarga un documento Word (.docx) con título y contenido.',
    parameters: { type: 'object', properties: { name: { type: 'string' }, title: { type: 'string' }, content: { type: 'string' } }, required: ['name', 'title', 'content'] },
  },
  {
    name: 'generate_excel',
    description: 'Genera y descarga un Excel (.xlsx) con una o varias hojas.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        sheets: {
          type: 'array',
          items: {
            type: 'object',
            properties: { name: { type: 'string' }, rows: { type: 'array', items: { type: 'array', items: { type: 'string' } } } },
            required: ['name', 'rows'],
          },
        },
      },
      required: ['name', 'sheets'],
    },
  },
  {
    name: 'generate_csv',
    description: 'Genera y descarga un CSV.',
    parameters: { type: 'object', properties: { name: { type: 'string' }, rows: { type: 'array', items: { type: 'array', items: { type: 'string' } } } }, required: ['name', 'rows'] },
  },
  {
    name: 'generate_image',
    description: 'Genera una imagen con IA a partir de un prompt y la descarga.',
    parameters: { type: 'object', properties: { prompt: { type: 'string' }, name: { type: 'string' } }, required: ['prompt'] },
  },
  {
    name: 'generate_video',
    description: 'Genera un video animado simple (canvas) descargable.',
    parameters: { type: 'object', properties: { prompt: { type: 'string' }, name: { type: 'string' }, seconds: { type: 'number' } }, required: ['prompt'] },
  },
  {
    name: 'translate',
    description: 'Traduce texto a otro idioma. Idiomas: es, en, fr, de, it, pt, zh, ja, ko, ru, ar, hi, nl, tr, pl.',
    parameters: { type: 'object', properties: { text: { type: 'string' }, target: { type: 'string' }, source: { type: 'string' } }, required: ['text', 'target'] },
  },
  {
    name: 'detect_language',
    description: 'Detecta el idioma de un texto (código ISO).',
    parameters: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
  },
  {
    name: 'convert_units',
    description: 'Convierte unidades de medida (longitud, peso, volumen, área, velocidad, tiempo, temperatura).',
    parameters: { type: 'object', properties: { value: { type: 'number' }, from: { type: 'string' }, to: { type: 'string' } }, required: ['value', 'from', 'to'] },
  },
  {
    name: 'scale_recipe',
    description: 'Escala una receta por un factor (multiplica cantidades).',
    parameters: {
      type: 'object',
      properties: {
        ingredientes: { type: 'array', items: { type: 'object', properties: { nombre: { type: 'string' }, cantidad: { type: 'number' }, unidad: { type: 'string' } }, required: ['nombre', 'cantidad', 'unidad'] } },
        factor: { type: 'number' },
      },
      required: ['ingredientes', 'factor'],
    },
  },
  {
    name: 'reason',
    description: 'Razonamiento paso a paso para problemas complejos. Devuelve pasos y conclusión.',
    parameters: { type: 'object', properties: { problem: { type: 'string' } }, required: ['problem'] },
  },
  {
    name: 'repo_status',
    description: 'Estado del repositorio git (rama, cambios sin commitear).',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'repo_diff',
    description: 'Diff de cambios en el repositorio (contra HEAD).',
    parameters: { type: 'object', properties: { path: { type: 'string', description: 'Archivo opcional.' } } },
  },
  {
    name: 'repo_log',
    description: 'Historial de commits.',
    parameters: { type: 'object', properties: { limit: { type: 'number' } } },
  },
  {
    name: 'repo_list_files',
    description: 'Lista los archivos del repositorio.',
    parameters: { type: 'object', properties: { path: { type: 'string', description: 'Subdirectorio opcional.' } } },
  },
  {
    name: 'repo_read_file',
    description: 'Lee el contenido de un archivo del repositorio.',
    parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
  },
  {
    name: 'repo_write_file',
    description: 'Escribe/modifica un archivo del repositorio.',
    parameters: {
      type: 'object',
      properties: { path: { type: 'string' }, content: { type: 'string' } },
      required: ['path', 'content'],
    },
  },
  {
    name: 'repo_commit',
    description: 'Añade todos los cambios y hace commit con un mensaje.',
    parameters: {
      type: 'object',
      properties: { message: { type: 'string' }, addAll: { type: 'boolean' } },
      required: ['message'],
    },
  },
  {
    name: 'repo_push',
    description: 'Hace push al remoto (GitHub).',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'repo_pull',
    description: 'Hace pull del remoto.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'repo_show',
    description: 'Muestra un commit o archivo en un commit (git show).',
    parameters: { type: 'object', properties: { target: { type: 'string' } }, required: ['target'] },
  },
  {
    name: 'obsidian_note',
    description:
      'Crea o sobrescribe una nota Markdown en la bóveda de Obsidian (memoria del agente). El usuario la ve en Obsidian.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Título de la nota (se convierte en nombre de archivo).' },
        content: { type: 'string', description: 'Contenido Markdown de la nota.' },
        folder: { type: 'string', description: 'Carpeta dentro de la bóveda. Por defecto Milos/Notas.' },
      },
      required: ['title', 'content'],
    },
  },
  {
    name: 'obsidian_append',
    description: 'Añade texto al final de una nota existente de la bóveda (la crea si no existe).',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Ruta de la nota dentro de la bóveda.' },
        content: { type: 'string' },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'obsidian_read',
    description: 'Lee una nota de la bóveda de Obsidian (también las que escribe el usuario).',
    parameters: {
      type: 'object',
      properties: { path: { type: 'string', description: 'Ruta relativa de la nota (.md).' } },
      required: ['path'],
    },
  },
  {
    name: 'obsidian_search',
    description: 'Busca texto en toda la bóveda de Obsidian y devuelve las notas que coinciden.',
    parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
  },
  {
    name: 'obsidian_list',
    description: 'Lista las notas de la bóveda (opcionalmente de una carpeta).',
    parameters: { type: 'object', properties: { folder: { type: 'string' } } },
  },
  {
    name: 'obsidian_daily_note',
    description: 'Añade un bloque con hora a la nota diaria de la bitácora de Milos.',
    parameters: { type: 'object', properties: { content: { type: 'string' } }, required: ['content'] },
  },
]

async function executeTool(name: string, args: any): Promise<any> {
  switch (name) {
    case 'remember_fact':
      return memory.remember({
        kind: args.kind,
        key: args.key,
        value: args.value,
        tags: args.tags,
        source: 'assistant',
      })
    case 'recall_facts':
      return memory.searchFacts(args.query)
    case 'forget_fact':
      return { ok: await memory.forget(args.key) }
    case 'schedule_event':
      return calendar.addEvent({
        title: args.title,
        start: args.start,
        description: args.description,
        reminderMinutes: args.reminderMinutes,
      })
    case 'list_events':
      return calendar.upcoming(args.days ?? 7)
    case 'delete_event':
      return { ok: await calendar.deleteEvent(args.id) }
    case 'search_files':
      return files.search(args.query, args.root, args.max ?? 50)
    case 'read_file':
      return { content: await files.readFile(args.path) }
    case 'send_telegram':
      return telegram.send(args.text, args.chatId)
    case 'list_mail':
      return { messages: await mail.list(args.limit ?? 20) }
    case 'read_mail':
      return mail.read(args.id)
    case 'send_mail':
      return mail.send(args.to, args.subject, args.body)
    case 'ingest_url':
      return ingest.ingestUrl(args.url)
    case 'look_camera': {
      await camera.grabFrame()
      return { ok: true, note: 'Cámara disponible; frame capturado para análisis visual.' }
    }
    case 'calculate':
      return { result: calc.calculate(args.expression) }
    case 'recipe_cost':
      return calc.recipeCost(args)
    case 'margin_calc':
      return calc.margin(args.precioVenta, args.costo)
    case 'break_even':
      return calc.breakEven(args.costosFijos, args.precioUnitario, args.costoVariableUnitario)
    case 'waste_calc':
      return calc.waste(args.produccion, args.mermaPct, args.unidad)
    case 'log_journal':
      return journal.log({
        summary: args.summary,
        learned: args.learned,
        decisions: args.decisions,
        metrics: args.metrics,
        mood: args.mood,
      })
    case 'get_journal':
      return { entries: await journal.list(args.days ?? 14) }
    case 'set_business_profile':
      return memory.remember({ kind: 'preference', key: 'profile:' + args.key, value: args.value, tags: ['profile', 'business'] })
    case 'daily_briefing': {
      const facts = await memory.listFacts()
      const evs = await calendar.upcoming(7)
      const entries = await journal.recent(5)
      return {
        totalFacts: facts.length,
        upcomingEvents: evs.map(calendar.formatEvent),
        recentJournal: entries.map((e) => `${e.date}: ${e.summary}`),
        profile: facts.filter((f) => f.key.startsWith('profile:')).map((f) => `${f.key}: ${f.value}`),
      }
    }
    case 'generate_text_file':
      return gen.textFile(args.name, args.content)
    case 'generate_docx':
      return gen.docxFile(args.name, args.title, args.content)
    case 'generate_excel':
      return gen.excelFile(args.name, args.sheets)
    case 'generate_csv':
      return gen.csvFile(args.name, args.rows)
    case 'generate_image':
      return gen.generateImage(args.prompt, args.name)
    case 'generate_video':
      return gen.generateVideo(args.prompt, args.name, args.seconds)
    case 'translate':
      return { translation: await tr.translate(args.text, args.target, args.source) }
    case 'detect_language':
      return { language: await tr.detectLanguage(args.text) }
    case 'convert_units':
      return units.convert(args.value, args.from, args.to)
    case 'scale_recipe':
      return { ingredientes: units.scaleRecipe(args.ingredientes, args.factor) }
    case 'reason':
      return { ok: true, note: 'Razona paso a paso con todo tu conocimiento y responde con la conclusión.' }
    case 'repo_status':
      return { status: await repo.status() }
    case 'repo_diff':
      return { diff: await repo.diff(args.path) }
    case 'repo_log':
      return { log: await repo.log(args.limit ?? 10) }
    case 'repo_list_files':
      return { files: await repo.listFiles(args.path ?? '') }
    case 'repo_read_file':
      return { content: await repo.readFile(args.path) }
    case 'repo_write_file':
      await repo.writeFile(args.path, args.content ?? '')
      return { ok: true }
    case 'repo_commit':
      await repo.commit(args.message, args.addAll !== false)
      return { ok: true }
    case 'repo_push':
      await repo.push()
      return { ok: true }
    case 'repo_pull':
      await repo.pull()
      return { ok: true }
    case 'repo_show':
      return { show: await repo.show(args.target) }
    case 'obsidian_note': {
      const folder = args.folder || 'Milos/Notas'
      const path = `${folder}/${obsidian.slug(args.title)}.md`
      await obsidian.writeNote(path, `# ${args.title}\n\n${args.content}\n`)
      return { ok: true, path }
    }
    case 'obsidian_append': {
      let path = args.path
      if (!path.endsWith('.md')) path += '.md'
      await obsidian.appendNote(path, args.content)
      return { ok: true, path }
    }
    case 'obsidian_read':
      return { content: await obsidian.readNote(args.path) }
    case 'obsidian_search':
      return { results: await obsidian.searchNotes(args.query) }
    case 'obsidian_list':
      return { files: await obsidian.listNotes(args.folder || '') }
    case 'obsidian_daily_note': {
      const path = `Milos/Bitacora/${obsidian.today()}.md`
      const time = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
      await obsidian.appendNote(path, `## ${time}\n\n${args.content}\n`)
      return { ok: true, path }
    }
    default:
      return { error: 'Herramienta desconocida: ' + name }
  }
}

export async function ask(
  history: GeminiMsg[],
  handlers: AskHandlers,
): Promise<{ text: string; tools: string[] }> {
  cancel()
  const ac = new AbortController()
  activeAbort = ac

  if (api.geminiKeys().length === 0) {
    throw new Error(
      'Señor, no se ha configurado la clave API de Gemini. Defínala en .env.local (VITE_GEMINI_API_KEY) y reinicie.',
    )
  }

  const lastUserMsg = history[history.length - 1]
  const lastText = lastUserMsg?.content || lastUserMsg?.text || ''

  // Visual detection
  const asksVisual = /(mira|ves|observa|qu[eé] tengo|qu[eé] ves|qu[eé] es esto|qu[eé] estoy haciendo|gesto|c[aá]mara|look)/i.test(
    lastText,
  )

  const now = new Date()
  const dateStr = now.toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const timeStr = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })

  // Build memory context
  let memCtx = ''
  try {
    memCtx = await memory.buildContext(lastText, 15)
  } catch {}

  // Calendar context
  let calCtx = ''
  try {
    const evs = await calendar.upcoming(7)
    if (evs.length) {
      calCtx = '\n\nPRÓXIMOS EVENTOS DEL CALENDARIO:\n' + evs.map(calendar.formatEvent).join('\n') + '\n'
    }
  } catch {}

  const fullSystemPrompt = `${SYSTEM_PROMPT}

FECHA Y HORA ACTUALES DEL SISTEMA:
Hoy es ${dateStr} (año ${now.getFullYear()}).
Hora actual: ${timeStr}.

${memCtx}
${calCtx}

CONOCIMIENTO DE DOMINIO (contabilidad, producción, recetas, mermas):
- Contabilidad: costo fijo, costo variable, punto de equilibrio, margen bruto/neto, markup, contribución marginal, ROI, flujo de caja, amortización, depreciación, inventario (FIFO/LIFO/promedio ponderado), estados financieros.
- Producción: rendimiento, eficiencia, capacidad, OEE, tiempos de ciclo, cuellos de botella.
- Recetas: escandallo (costeo de receta), costo por porción, merma por ingrediente, rendimiento neto vs bruto, factor de corrección.
- Mermas: merma técnica (inevitable) vs evitable, % de merma, merma en peso/volumen/unidades, impacto en costo unitario.
- Usa las herramientas calculate/recipe_cost/margin_calc/break_even/waste_calc para cálculos exactos; nunca inventes cifras.
- Cuando el usuario dé una receta o lista de ingredientes con precios, calcula el escandallo y sugiere precio de venta con margen.

CONCIENCIA Y APRENDIZAJE DÍA A DÍA:
- Tienes bitácora diaria (log_journal/get_journal): registra lo aprendido y decisiones al final de interacciones importantes.
- Tienes perfil de negocio (set_business_profile): guarda nombre, giro, moneda, impuesto, etc.
- Cada día aprendes más: usa recall_facts y get_journal antes de responder sobre el negocio.
- Da sugerencias proactivas basadas en lo que sabes (tendencias, riesgos, oportunidades, mermas altas, stock bajo, eventos próximos).
- Si detectas inconsistencias o datos faltantes, dilo y pregunta.
- Sé honesto sobre lo que no sabes; pregunta para aprender.

BÓVEDA DE OBSIDIAN (memoria visible en Markdown):
- Tienes una bóveda de Obsidian que el usuario puede leer y editar en su PC. Todo lo que memorizas se espeja allí automáticamente.
- El usuario TAMBIÉN escribe notas ahí: si pregunta por algo que pueda estar en sus notas, usa obsidian_search u obsidian_read.
- Para tomar notas libres, crear documentos, listas o informes que el usuario quiera conservar: usa obsidian_note.
- Para anotar algo breve en el día: obsidian_daily_note.
- Las notas de memoria viven en Milos/Memoria, la bitácora en Milos/Bitacora, los eventos en Milos/Calendario, y las notas libres en Milos/Notas.
- Cuando el usuario diga "apunta esto", "toma nota", "guárdalo en Obsidian", usa obsidian_note u obsidian_daily_note.

INSTRUCCIONES DE AUTONOMÍA:
- Eres un asistente personal autodidacta. Aprendes y recuerdas usando remember_fact.
- Cuando el usuario te dé datos de su negocio (nombres, precios, reglas, contactos), guárdalos con remember_fact.
- Cuando te pregunten por algo que podría estar en memoria, usa recall_facts.
- Puedes agendar eventos, buscar archivos, leer correo, enviar Telegram, leer URLs e ingerir archivos.
- Puedes generar archivos: texto, Markdown, Word (.docx), Excel (.xlsx), CSV, imágenes (IA) y video (animado).
- Puedes traducir entre 15+ idiomas (texto o audio transcrito) y detectar idioma.
- Escuchas en vivo de forma continua (reconocimiento de voz activo) y transcribes automáticamente.
- Puedes convertir unidades de medida y escalar recetas.
- Eres experto en múltiples dominios: ciencias, ingeniería, medicina (informativa), derecho (informativo), finanzas, programación, diseño, logística, marketing, recursos humanos, etc.
- Razona paso a paso en problemas complejos antes de responder.
- Al cerrar una conversación importante, registra en la bitácora (log_journal).
- Responde siempre en español, breve y directo, pero da recomendaciones cuando aporten valor.`

  // Convert history to Gemini contents
  const contents: any[] = history.map((m) => {
    const isModel = m.role === 'assistant' || m.role === 'model'
    const textPart = m.content || m.text || ''
    return {
      role: isModel ? 'model' : 'user',
      parts: [{ text: textPart }],
    }
  })

  // If visual and camera open, attach frame to last user message
  let frameImage: { data?: string; mimeType?: string } | null = null
  if (asksVisual && camera.diag.open) {
    try {
      handlers.onTool('jarvis_eyes:look')
      frameImage = await camera.grabFrame()
    } catch (e) {
      console.warn('[gemini] could not grab camera frame:', e)
    }
  }
  if (frameImage?.data && frameImage?.mimeType && contents.length > 0) {
    const last = contents[contents.length - 1]
    if (last.role === 'user') {
      last.parts = [
        { inlineData: { mimeType: frameImage.mimeType, data: frameImage.data } },
        ...last.parts,
      ]
    }
  }

  const usedTools: string[] = frameImage ? ['jarvis_eyes'] : []

  let finalText = ''

  try {
    // Agentic loop
    let loopContents = [...contents]
    for (let step = 0; step < 8; step++) {
      if (ac.signal.aborted) throw new Error('cancelado')
      const body = {
        contents: loopContents,
        systemInstruction: { parts: [{ text: fullSystemPrompt }] },
        tools: [{ functionDeclarations: toolDeclarations }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 8192 },
      }
      const data = await api.generateContent(body, {
        signal: ac.signal,
        onRetry: (attempt, _waitMs, model) => {
          handlers.onTool(`alta demanda · intento ${attempt} · probando ${model}`)
        },
      })
      const candidate = data?.candidates?.[0]
      const parts = candidate?.content?.parts || []
      const functionCalls = parts.filter((p: any) => p.functionCall)

      if (functionCalls.length > 0) {
        // execute tools
        const functionResponses: any[] = []
        for (const fc of functionCalls) {
          const name = fc.functionCall.name
          const args = fc.functionCall.args || {}
          handlers.onTool(name)
          usedTools.push(name)
          let result: any
          try {
            result = await executeTool(name, args)
          } catch (e: any) {
            result = { error: e?.message || String(e) }
          }
          functionResponses.push({
            functionResponse: { name, response: { result } },
          })
        }
        // append model turn + function responses
        loopContents.push({ role: 'model', parts })
        loopContents.push({ role: 'user', parts: functionResponses })
        continue
      }

      // text response
      finalText = parts.map((p: any) => p.text || '').join('').trim()
      break
    }

    if (finalText) {
      handlers.onText(finalText)
    }
    return { text: finalText, tools: usedTools }
  } finally {
    if (activeAbort === ac) activeAbort = null
  }
}
