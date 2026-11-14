import { useStore, accentFor, type Phase } from '../store'
import './fx.css'

// Segundos por vuelta del globo según la fase: lento en reposo, rápido pensando.
const SPIN: Record<Phase, number> = { offline: 80, boot: 60, dormant: 80, waking: 40, listening: 40, thinking: 14, tooling: 12, speaking: 28 }
const R = 150
const LATS = [-50, -25, 0, 25, 50].map((a) => {
  const d = 2 * R * Math.cos((a * Math.PI) / 180)
  const y = R * Math.sin((a * Math.PI) / 180)
  return { d, y }
})
const MERS = [0, 45, 90, 135]

/** Globo de puntos en 3D con tres órbitas y satélites, detrás del orbe. Puntos con el color de la fase. */
export function UniverseGlobe() {
  const phase = useStore((s) => s.phase)
  const ui = useStore((s) => s.ui)
  const accent = accentFor(phase, ui)
  return (
    <div className="fx-globe" aria-hidden="true" style={{ color: accent }}>
      <div className="fx-globe-spin" style={{ animationDuration: `${SPIN[phase]}s` }}>
        {LATS.map((l, i) => (
          <div
            key={i}
            className="fx-dots"
            style={{ left: R * 1.4 - l.d / 2, top: R * 1.4 - l.d / 2, width: l.d, height: l.d, transform: `rotateX(90deg) translateZ(${l.y}px)` }}
          />
        ))}
        {MERS.map((a) => (
          <div
            key={a}
            className="fx-dots mer"
            style={{ left: R * 1.4 - R, top: R * 1.4 - R, width: 2 * R, height: 2 * R, transform: `rotateY(${a}deg)` }}
          />
        ))}
      </div>
      <div className="fx-tilt" style={{ transform: 'rotateX(72deg)' }}>
        <div className="fx-orb3" style={{ width: 420, height: 420, marginLeft: -210, marginTop: -210, color: '#b46bff' }} />
      </div>
      <div className="fx-tilt" style={{ transform: 'rotateY(68deg) rotateX(10deg)' }}>
        <div className="fx-orb3 rev" style={{ width: 390, height: 390, marginLeft: -195, marginTop: -195, color: '#2dffa6' }} />
      </div>
      <div className="fx-tilt" style={{ transform: 'rotateX(58deg) rotateY(-32deg)' }}>
        <div className="fx-orb3 slow" style={{ width: 360, height: 360, marginLeft: -180, marginTop: -180, color: '#26f0ff' }} />
      </div>
    </div>
  )
}
