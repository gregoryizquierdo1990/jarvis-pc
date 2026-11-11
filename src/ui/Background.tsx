import { useEffect, useRef } from 'react'

/**
 * Fondo animado con las imágenes "robot*" de /public: slideshow con crossfade
 * suave, efecto Ken Burns (zoom/pan), rejilla cyberpunk, partículas y orbes.
 */
export function Background() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current as HTMLCanvasElement
    if (!canvas) return
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
    if (!ctx) return

    let raf = 0
    let w = 0
    let h = 0
    const particles: { x: number; y: number; vx: number; vy: number; r: number; hue: number }[] = []
    const orbs: { x: number; y: number; vx: number; vy: number; r: number; hue: number }[] = []

    function resize() {
      w = canvas.width = window.innerWidth
      h = canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    for (let i = 0; i < 70; i++) {
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
        r: Math.random() * 1.4 + 0.3,
        hue: Math.random() > 0.5 ? 185 : 300,
      })
    }
    for (let i = 0; i < 3; i++) {
      orbs.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.12,
        vy: (Math.random() - 0.5) * 0.12,
        r: 150 + Math.random() * 200,
        hue: i % 2 === 0 ? 185 : 300,
      })
    }
    // 3 orbes extra formando un racimo, separados ~0.5 cm (~19 px) entre sí
    const CLUSTER_X = w * 0.22
    const CLUSTER_Y = h * 0.3
    const GAP = 19 // ≈ 0.5 cm en pantalla típica
    const clusterOffsets = [
      { x: 0, y: 0 },
      { x: GAP, y: 0 },
      { x: 0, y: GAP },
    ]
    clusterOffsets.forEach((o) => {
      orbs.push({
        x: CLUSTER_X + o.x,
        y: CLUSTER_Y + o.y,
        vx: 0.06,
        vy: -0.04,
        r: 90,
        hue: 320,
      })
    })

    let t = 0

    function draw() {
      t += 0.004

      // fondo base
      const g = ctx.createLinearGradient(0, 0, w, h)
      g.addColorStop(0, '#02040a')
      g.addColorStop(0.5, '#050a1a')
      g.addColorStop(1, '#0a0518')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, w, h)

      // orbes
      for (const o of orbs) {
        o.x += o.vx
        o.y += o.vy
        if (o.x < -o.r || o.x > w + o.r) o.vx *= -1
        if (o.y < -o.r || o.y > h + o.r) o.vy *= -1
        const rg = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r)
        rg.addColorStop(0, `hsla(${o.hue}, 95%, 65%, 0.35)`)
        rg.addColorStop(0.4, `hsla(${o.hue}, 90%, 55%, 0.18)`)
        rg.addColorStop(1, `hsla(${o.hue}, 90%, 55%, 0)`)
        ctx.fillStyle = rg
        ctx.fillRect(o.x - o.r, o.y - o.r, o.r * 2, o.r * 2)
        // núcleo brillante
        const core = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r * 0.12)
        core.addColorStop(0, `hsla(${o.hue}, 100%, 80%, 0.55)`)
        core.addColorStop(1, `hsla(${o.hue}, 100%, 70%, 0)`)
        ctx.fillStyle = core
        ctx.fillRect(o.x - o.r, o.y - o.r, o.r * 2, o.r * 2)
      }

      // rejilla
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.05)'
      ctx.lineWidth = 1
      const horizon = h * 0.6
      const lines = 16
      for (let i = 0; i < lines; i++) {
        const p = (i / lines + (t * 0.12 % (1 / lines))) % 1
        const y = horizon + (h - horizon) * (p * p)
        const spread = (y - horizon) / (h - horizon)
        ctx.beginPath()
        ctx.moveTo(w / 2 - (w * 0.85) * spread, y)
        ctx.lineTo(w / 2 + (w * 0.85) * spread, y)
        ctx.stroke()
      }
      for (let i = -5; i <= 5; i++) {
        ctx.beginPath()
        ctx.moveTo(w / 2, horizon)
        ctx.lineTo(w / 2 + i * (w / 10), h)
        ctx.stroke()
      }

      // partículas + conexiones
      for (const p of particles) {
        p.x += p.vx
        p.y += p.vy
        if (p.x < 0) p.x = w
        if (p.x > w) p.x = 0
        if (p.y < 0) p.y = h
        if (p.y > h) p.y = 0
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `hsla(${p.hue}, 95%, 75%, 0.95)`
        ctx.fill()
        // halo brillante
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r * 3, 0, Math.PI * 2)
        ctx.fillStyle = `hsla(${p.hue}, 95%, 70%, 0.18)`
        ctx.fill()
      }
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.12)'
      ctx.lineWidth = 0.5
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i]
          const b = particles[j]
          const d = Math.hypot(a.x - b.x, a.y - b.y)
          if (d < 100) {
            ctx.globalAlpha = 1 - d / 100
            ctx.beginPath()
            ctx.moveTo(a.x, a.y)
            ctx.lineTo(b.x, b.y)
            ctx.stroke()
            ctx.globalAlpha = 1
          }
        }
      }

      raf = requestAnimationFrame(draw)
    }
    draw()

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <>
      <canvas
        ref={canvasRef}
        style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}
      />
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1,
          pointerEvents: 'none',
          background:
            'repeating-linear-gradient(0deg, rgba(0,240,255,0.025) 0px, rgba(0,240,255,0.025) 1px, transparent 1px, transparent 3px)',
          mixBlendMode: 'overlay',
        }}
      />
    </>
  )
}
