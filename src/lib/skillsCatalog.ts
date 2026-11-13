/**
 * Catálogo de Habilidades dinámicas basado en el estándar anthropics/skills (SKILL.md).
 *
 * Permite a Milos descubrir habilidades bajo demanda, cargarlas en su contexto
 * y aprender nuevas capacidades modulares.
 */

export type Skill = {
  name: string
  description: string
  version?: string
  tags?: string[]
  instructions: string
  source: 'local' | 'remote'
}

// Habilidades precargadas inspiradas en anthropics/skills
const DEFAULT_SKILLS: Skill[] = [
  {
    name: 'deep-research',
    description: 'Investigación técnica y de mercado paso a paso con contrastación de fuentes y síntesis.',
    version: '1.0.0',
    tags: ['investigación', 'análisis', 'web'],
    source: 'local',
    instructions: `METODOLOGÍA DE INVESTIGACIÓN PROFUNDA:
1. Descompón la consulta del usuario en 3 preguntas fundamentales.
2. Identifica hechos corroborados, consensos y discrepancias.
3. Estructura el resultado en: Resumen ejecutivo, Hallazgos clave, Oportunidades y Conclusión práctica.
4. Siempre cita fuentes concretas o aclara el grado de certeza.`
  },
  {
    name: 'business-financial-audit',
    description: 'Auditoría de costos, fijación de precios, margen de contribución y punto de equilibrio.',
    version: '1.0.0',
    tags: ['finanzas', 'negocios', 'costos'],
    source: 'local',
    instructions: `METODOLOGÍA DE AUDITORÍA FINANCIERA:
1. Identifica Costo Fijo total (alquiler, salarios, suministros base) y Costo Variable Unitario.
2. Calcula Margen de Contribución = Precio de Venta - Costo Variable.
3. Calcula Punto de Equilibrio = Costo Fijo / Margen de Contribución.
4. Evalúa impacto de mermas e impuestos en el margen final.`
  },
  {
    name: 'git-repo-architect',
    description: 'Auditoría de código, ramas, cambios pendientes y sugerencias de commits limpios.',
    version: '1.0.0',
    tags: ['git', 'código', 'desarrollo'],
    source: 'local',
    instructions: `DIRECTRICES DE ARQUITECTO GIT:
1. Revisa siempre el diff y status antes de proponer un commit.
2. Aplica mensajes de commit convencionales (feat:, fix:, chore:, refactor:).
3. Asegura que los cambios no introduzcan secretos ni rompan el build.`
  },
  {
    name: 'n8n-workflow-designer',
    description: 'Diseño y optimización de flujos de automatización en n8n conectando APIs y webhooks.',
    version: '1.0.0',
    tags: ['n8n', 'automatización', 'webhooks'],
    source: 'local',
    instructions: `DISEÑO DE FLUJOS N8N:
1. Define el disparador (Webhook, Cron, Evento).
2. Estructura los nodos de transformación de datos (Code node o Set node).
3. Conecta los servicios de destino (Telegram, Correo, Base de datos).
4. Configura manejo de errores y reintentos.`
  }
]

let runtimeSkills: Skill[] = [...DEFAULT_SKILLS]

export function listSkills(): Skill[] {
  return runtimeSkills
}

export function searchSkills(query: string): Skill[] {
  const q = query.toLowerCase()
  return runtimeSkills.filter(
    (s) =>
      s.name.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.tags?.some((t) => t.toLowerCase().includes(q))
  )
}

export function getSkill(name: string): Skill | undefined {
  return runtimeSkills.find((s) => s.name.toLowerCase() === name.toLowerCase())
}

export function registerSkill(skill: Skill): void {
  const existing = runtimeSkills.findIndex((s) => s.name === skill.name)
  if (existing >= 0) {
    runtimeSkills[existing] = skill
  } else {
    runtimeSkills.push(skill)
  }
}

/** Descarga una skill en formato SKILL.md desde GitHub (anthropics/skills u otro repo) */
export async function fetchRemoteSkill(repoPath: string): Promise<Skill | null> {
  try {
    const url = repoPath.startsWith('http')
      ? repoPath
      : `https://raw.githubusercontent.com/anthropics/skills/main/skills/${repoPath}/SKILL.md`

    const res = await fetch(url)
    if (!res.ok) return null
    const text = await res.text()

    // Parse simple frontmatter
    let name = repoPath.split('/').pop()?.replace('.md', '') || 'remote-skill'
    let description = 'Habilidad descargada de anthropics/skills'
    let instructions = text

    if (text.startsWith('---')) {
      const parts = text.split('---')
      if (parts.length >= 3) {
        const fm = parts[1]
        instructions = parts.slice(2).join('---').trim()
        const nameMatch = fm.match(/name:\s*(.+)/)
        const descMatch = fm.match(/description:\s*(.+)/)
        if (nameMatch) name = nameMatch[1].trim().replace(/['"]/g, '')
        if (descMatch) description = descMatch[1].trim().replace(/['"]/g, '')
      }
    }

    const skill: Skill = {
      name,
      description,
      instructions,
      source: 'remote'
    }
    registerSkill(skill)
    return skill
  } catch (err) {
    console.warn('[skills] error fetching remote skill:', err)
    return null
  }
}
