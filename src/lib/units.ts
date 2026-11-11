/**
 * Conversión y escalado de unidades de medida.
 */

const FACTORS: Record<string, Record<string, number>> = {
  length: { m: 1, km: 1000, cm: 0.01, mm: 0.001, in: 0.0254, ft: 0.3048, yd: 0.9144, mi: 1609.34 },
  weight: { kg: 1, g: 0.001, mg: 0.000001, lb: 0.453592, oz: 0.0283495, t: 1000 },
  volume: { l: 1, ml: 0.001, gal: 3.78541, qt: 0.946353, pt: 0.473176, cup: 0.236588, floz: 0.0295735, tbsp: 0.0147868, tsp: 0.00492892 },
  area: { m2: 1, km2: 1e6, cm2: 1e-4, ft2: 0.092903, in2: 0.00064516, acre: 4046.86, ha: 10000 },
  speed: { 'm/s': 1, 'km/h': 0.277778, mph: 0.44704, knot: 0.514444 },
  time: { s: 1, min: 60, h: 3600, d: 86400, week: 604800 },
}

export function convert(value: number, from: string, to: string, category?: string): { result: number; from: string; to: string } {
  const f = from.toLowerCase()
  const t = to.toLowerCase()
  // temperature special
  if (f === 'c' || f === 'celsius' || f === 'f' || f === 'fahrenheit' || f === 'k' || f === 'kelvin') {
    let c: number
    if (f.startsWith('c')) c = value
    else if (f.startsWith('f')) c = (value - 32) * (5 / 9)
    else c = value - 273.15
    let out: number
    if (t.startsWith('c')) out = c
    else if (t.startsWith('f')) out = c * (9 / 5) + 32
    else out = c + 273.15
    return { result: round(out), from, to }
  }
  // find category
  let cat = category
  if (!cat) {
    for (const [c, m] of Object.entries(FACTORS)) {
      if (m[f] != null && m[t] != null) { cat = c; break }
    }
  }
  if (!cat || !FACTORS[cat]) throw new Error('Categoría de unidad desconocida')
  const m = FACTORS[cat]
  if (m[f] == null || m[t] == null) throw new Error('Unidad desconocida')
  const result = (value * m[f]) / m[t]
  return { result: round(result), from, to }
}

export function scaleRecipe(ingredients: { nombre: string; cantidad: number; unidad: string }[], factor: number) {
  return ingredients.map((i) => ({
    nombre: i.nombre,
    cantidad: round(i.cantidad * factor),
    unidad: i.unidad,
  }))
}

export function listUnits() {
  return Object.keys(FACTORS)
}

function round(n: number) {
  return Math.round(n * 10000) / 10000
}
