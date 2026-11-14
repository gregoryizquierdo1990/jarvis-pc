import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore, accentFor } from '../store'
import './fx.css'

type ToolNode = { id: number; name: string }

/** "mcp__servidor__buscar_web" → "buscar web" */
export function humanizeTool(n: string): string {
  const last = n.split('__').pop() ?? n
  const t = last.replace(/[_-]+/g, ' ').trim()
  return t.length > 24 ? `${t.slice(0, 23)}…` : t
}

const R_IN = 158
const R_OUT = 262
const SLOTS = 6

/** Constelación alrededor del orbe: un nodo por herramienta realmente usada en el turno actual. */
export function ToolConstellation() {
  const phase = useStore((s) => s.phase)
  const tool = useStore((s) => s.activeTool)
  const ui = useStore((s) => s.ui)
  const [trail, setTrail] = useState<ToolNode[]>([])
  const seq = useRef(0)

  // Turno nuevo → constelación nueva.
  useEffect(() => {
    if (phase === 'thinking') setTrail([])
  }, [phase])

  useEffect(() => {
    if (!tool) return
    setTrail((t) =>
      t.length > 0 && t[t.length - 1].name === tool ? t : [...t.slice(-(SLOTS - 1)), { id: ++seq.current, name: tool }],
    )
  }, [tool])

  if (phase !== 'tooling' || trail.length === 0) return null
  const accent = accentFor(phase, ui)

  return (
    <svg className="fx-const" viewBox="-350 -350 700 700" style={{ color: accent }} aria-hidden="true">
      {trail.map((n, i) => {
        const a = ((-90 + ((n.id - 1) % SLOTS) * 60) * Math.PI) / 180
        const x = R_OUT * Math.cos(a)
        const y = R_OUT * Math.sin(a)
        const active = i === trail.length - 1 && tool === n.name
        const anchor = x > 20 ? 'start' : x < -20 ? 'end' : 'middle'
        const lx = anchor === 'start' ? x + 14 : anchor === 'end' ? x - 14 : x
        const ly = anchor === 'middle' ? y + (y < 0 ? -18 : 26) : y + 4
        return (
          <g key={n.id} className="fx-node" opacity={active ? 1 : 0.6}>
            <line className={active ? 'fx-link' : 'fx-link done'} x1={R_IN * Math.cos(a)} y1={R_IN * Math.sin(a)} x2={x} y2={y} />
            {active && <circle className="fx-halo" cx={x} cy={y} r={6} />}
            <circle cx={x} cy={y} r={active ? 6 : 4.5} fill="currentColor" />
            <text className="fx-label" x={lx} y={ly} textAnchor={anchor}>
              {humanizeTool(n.name)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

const CODE_RE = /bash|shell|code|python|script|exec|run|write|edit|file|terminal|command|git|npm/i

/** Columnas de datos muy tenues en los bordes; solo aparecen con herramientas de código o archivos. */
export function CodeColumns() {
  const phase = useStore((s) => s.phase)
  const tool = useStore((s) => s.activeTool)
  const ui = useStore((s) => s.ui)
  const cols = useMemo(
    () =>
      Array.from({ length: 4 }, (_, c) => {
        const block = Array.from({ length: 48 }, (_, i) =>
          Array.from({ length: 8 }, (_, k) => ((i * 37 + k * 11 + c * 53) % 16).toString(16)).join(''),
        ).join('\n')
        return `${block}\n${block}`
      }),
    [],
  )
  if (phase !== 'tooling' || !tool || !CODE_RE.test(tool)) return null
  const color = accentFor(phase, ui)
  return (
    <>
      {cols.map((txt, i) => (
        <div key={i} className="fx-code" aria-hidden="true" style={{ color, ...(i < 2 ? { left: i ? 112 : 14 } : { right: i === 2 ? 112 : 14 }) }}>
          <pre>{txt}</pre>
        </div>
      ))}
    </>
  )
}
