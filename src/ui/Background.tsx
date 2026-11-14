import { useMemo } from 'react'
import { useStore } from '../store'
import './fx.css'

const lcg = (seed: number) => () => (seed = (seed * 16807) % 2147483647) / 2147483647

/** Estrellas como sombras de un único elemento. Posiciones en vw/vh, así que valen para cualquier pantalla. */
function stars(n: number, seed: number, cols: string[]): string {
  const r = lcg(seed)
  return Array.from({ length: n }, () => `${(r() * 100).toFixed(1)}vw ${(r() * 100).toFixed(1)}vh 0 ${cols[Math.floor(r() * cols.length)]}`).join(',')
}

/**
 * Fondo "universo neón": cielo profundo, nebulosas (morado, azul, cian, verde) que derivan
 * muy despacio y dos capas de estrellas que parpadean. Solo CSS: sin bucle de canvas ni
 * partículas en JS, así que no pesa en equipos sin GPU.
 * Si Milos fija un color de fondo (ui.background), se respeta como base.
 */
export function Background() {
  const bg = useStore((s) => s.ui.background)
  const near = useMemo(() => stars(80, 7, ['#fff', '#bfe6ff', '#e3d0ff']), [])
  const far = useMemo(() => stars(26, 19, ['#8ff', '#fff', '#c9a8ff']), [])
  return (
    <div className="fx-uni" aria-hidden="true" style={bg ? { background: bg } : undefined}>
      <i className="fx-neb n1" />
      <i className="fx-neb n2" />
      <i className="fx-neb n3" />
      <i className="fx-neb n4" />
      <i className="fx-star s1" style={{ boxShadow: near }} />
      <i className="fx-star s2" style={{ boxShadow: far }} />
    </div>
  )
}
