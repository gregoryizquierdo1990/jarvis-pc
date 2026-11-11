/**
 * Calculadora segura para el asistente.
 * Soporta aritmética, porcentajes, funciones Math básicas.
 * También helpers de contabilidad: margen, punto de equilibrio, merma, costo unitario.
 */

export function calculate(expr: string): number {
  const clean = expr.trim()
  if (!clean) throw new Error('Expresión vacía')
  // Guard: solo caracteres seguros
  if (!/^[0-9+\-*/().,%\s]+$/.test(clean) && !/Math\./.test(clean)) {
    // permitir funciones Math.xxx
    if (!/^[\w\s+\-*/().,%]+$/.test(clean)) throw new Error('Expresión no permitida')
  }
  // Reemplazar % por /100 cuando va después de número: 10% -> 0.1
  const normalized = clean.replace(/(\d+(?:\.\d+)?)%/g, '($1/100)')
  // eslint-disable-next-line no-new-func
  const fn = new Function('Math', `"use strict"; return (${normalized})`)
  const result = fn(Math)
  if (typeof result !== 'number' || !isFinite(result)) throw new Error('Resultado inválido')
  return result
}

export type CostBreakdown = {
  ingredientes: { nombre: string; cantidad: number; unidad: string; costoUnitario: number; costo: number }[]
  costoTotalIngredientes: number
  mermaPct: number
  costoConMerma: number
  rendimiento: number
  costoUnitario: number
  precioSugerido: number
  margenPct: number
}

export function recipeCost(input: {
  ingredientes: { nombre: string; cantidad: number; unidad: string; costoUnitario: number }[]
  mermaPct?: number
  rendimiento: number // unidades producidas
  margenPct?: number // margen deseado sobre costo
}): CostBreakdown {
  const ing = input.ingredientes.map((i) => ({
    ...i,
    costo: i.cantidad * i.costoUnitario,
  }))
  const totalIng = ing.reduce((a, b) => a + b.costo, 0)
  const merma = input.mermaPct ?? 0
  const costoConMerma = totalIng / (1 - merma / 100)
  const unit = costoConMerma / input.rendimiento
  const margen = input.margenPct ?? 30
  const precio = unit / (1 - margen / 100)
  return {
    ingredientes: ing,
    costoTotalIngredientes: round2(totalIng),
    mermaPct: merma,
    costoConMerma: round2(costoConMerma),
    rendimiento: input.rendimiento,
    costoUnitario: round2(unit),
    precioSugerido: round2(precio),
    margenPct: margen,
  }
}

export function margin(precioVenta: number, costo: number) {
  const margenBruto = precioVenta - costo
  const margenPct = (margenBruto / precioVenta) * 100
  const markupPct = (margenBruto / costo) * 100
  return { margenBruto: round2(margenBruto), margenPct: round2(margenPct), markupPct: round2(markupPct) }
}

export function breakEven(costosFijos: number, precioUnitario: number, costoVariableUnitario: number) {
  const contribucion = precioUnitario - costoVariableUnitario
  if (contribucion <= 0) throw new Error('La contribución marginal debe ser positiva')
  const unidades = costosFijos / contribucion
  const ventas = unidades * precioUnitario
  return { unidades: round2(unidades), ventas: round2(ventas), contribucionUnitaria: round2(contribucion) }
}

export function waste(produccion: number, merma: number, unidad = 'unidades') {
  const perdida = produccion * (merma / 100)
  const aprovechable = produccion - perdida
  return { produccion, mermaPct: merma, perdida: round2(perdida), aprovechable: round2(aprovechable), unidad }
}

function round2(n: number) {
  return Math.round(n * 100) / 100
}
