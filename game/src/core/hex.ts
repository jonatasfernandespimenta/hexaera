// Coordenadas axiais (q, r), hexágonos "pointy-top". Centro = (0,0).
export type Hex = { q: number; r: number }

export const key = (h: Hex) => `${h.q},${h.r}`
export const parse = (k: string): Hex => {
  const [q, r] = k.split(',').map(Number)
  return { q, r }
}

const DIRS: Hex[] = [
  { q: 1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: -1 },
  { q: -1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: 1 },
]
export const neighbors = (h: Hex) => DIRS.map(d => ({ q: h.q + d.q, r: h.r + d.r }))

export const distance = (a: Hex, b: Hex = { q: 0, r: 0 }) =>
  (Math.abs(a.q - b.q) + Math.abs(a.r - b.r) + Math.abs(a.q + a.r - b.q - b.r)) / 2

export const toWorld = (h: Hex, size = 1): [number, number] =>
  [size * Math.sqrt(3) * (h.q + h.r / 2), size * 1.5 * h.r]
