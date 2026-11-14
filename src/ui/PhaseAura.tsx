import { useStore, type Phase } from '../store'
import './fx.css'

type Tone = 'cyan' | 'blue' | 'violet' | 'green'
const TONES: Tone[] = ['cyan', 'blue', 'violet', 'green']

// Una sola capa visible a la vez, siempre tenue. Fuera de línea no se pinta nada.
const AURA: Record<Phase, { tone: Tone; o: number } | null> = {
  offline: null,
  boot: { tone: 'cyan', o: 0.1 },
  dormant: { tone: 'cyan', o: 0.07 },
  waking: { tone: 'cyan', o: 0.16 },
  listening: { tone: 'blue', o: 0.18 },
  thinking: { tone: 'violet', o: 0.3 },
  tooling: { tone: 'violet', o: 0.34 },
  speaking: { tone: 'green', o: 0.22 },
}

/** Trazos de luz muy desenfocados que cambian de color con la fase de Milos.
 *  Son cuatro imágenes de ~8 KB que se funden por opacidad: sin filtros en tiempo real. */
export function PhaseAura() {
  const phase = useStore((s) => s.phase)
  const cfg = AURA[phase]
  return (
    <div className="fx-aura" aria-hidden="true">
      {TONES.map((t) => (
        <img
          key={t}
          className="fx-aura-img"
          src={`${import.meta.env.BASE_URL}fx/aura-${t}.webp`}
          alt=""
          decoding="async"
          draggable={false}
          style={{ opacity: cfg && cfg.tone === t ? cfg.o : 0 }}
        />
      ))}
    </div>
  )
}
