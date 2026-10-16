// Partida online: cálculos puros da cena e da interface (comitivas no mapa, faixa neutra, cargas, telas finais).
import { CARGO_PER_WORKER, type Convoy } from './core/convoy'
import type { Bag } from './core/data'
import { canChoose, type State } from './core/game'
import { EVENT_BY_ID } from './core/events'
import { distance, toWorld, type Hex } from './core/hex'
import { neutral, type Mode } from './core/match'

// Fração do caminho já percorrida no turno; null = já chegou (some do mapa).
export function convoyFraction(c: Convoy, turn: number): number | null {
  if (turn > c.arrive) return null
  return c.arrive > c.sent ? Math.min(1, Math.max(0, (turn - c.sent) / (c.arrive - c.sent))) : 1
}

export type Marker = { id: string; kind: Convoy['kind']; mine: boolean; n: number; x: number; z: number }

const size = (c: Convoy) => c.n ?? Object.values(c.bag ?? {}).reduce((a, v) => a + (v ?? 0), 0)

// Marcadores na reta entre os Centros (mundo local): as minhas vão de (0,0) ao rival, as dele voltam.
export function convoyMarkers(rival: Hex, mine: Convoy[], theirs: Convoy[], turn: number): Marker[] {
  const [rx, rz] = toWorld(rival)
  const out: Marker[] = []
  for (const [list, own] of [[mine, true], [theirs, false]] as const)
    for (const c of list) {
      const f = convoyFraction(c, turn)
      if (f === null) continue
      const t = own ? f : 1 - f
      out.push({ id: c.id, kind: c.kind, mine: own, n: size(c), x: rx * t, z: rz * t })
    }
  return out
}

// Faixa entre as cidades: neutra para os dois lados e a até STRIP passos de cada Centro.
const STRIP = 9
export function neutralStrip(s: State): Hex[] {
  if (!s.match) return []
  const rv = s.match.rival
  const out: Hex[] = []
  // Varre a caixa que cobre os dois Centros.
  for (let q = Math.min(0, rv.q) - STRIP; q <= Math.max(0, rv.q) + STRIP; q++)
  for (let r = Math.min(0, rv.r) - STRIP; r <= Math.max(0, rv.r) + STRIP; r++) {
    const h = { q, r }
    const a = distance(h), b = distance(h, rv)
    if (a <= STRIP && b <= STRIP && neutral(s, h) && b >= a - 2) out.push(h)
  }
  return out
}

// 👤 necessários para levar a carga (mesma conta de sendCargo).
export const carriers = (s: State, bag: Bag) =>
  Math.ceil(Object.values(bag).reduce((a, v) => a + (v ?? 0), 0) / CARGO_PER_WORKER[s.era])

export function endText(mode: Mode, over: 'won' | 'lost', rival: string) {
  if (mode === 'versus') return over === 'won' ? `Vitória — o Centro de ${rival} caiu` : 'Derrota — seu Centro caiu'
  return over === 'won' ? 'Civilização concluída juntos' : 'Um Centro caiu — a dupla perdeu'
}

// Relógio do turno: envia ao zerar se ainda não enviou, sem envio em andamento, sem evento aberto
// (bloqueia o envio) e fora da pausa após uma falha.
export type ClockRun = { fired: boolean; pending: boolean; retryAt: number }
export const shouldFire = (left: number, r: ClockRun, blocked: boolean, now: number) =>
  left === 0 && !r.fired && !r.pending && !blocked && now >= r.retryAt

// Jogador ausente com evento aberto: ao zerar o relógio, resolve o evento (depois o envio segue normal).
export const shouldResolve = (left: number, r: ClockRun, blocked: boolean) => left === 0 && blocked && !r.fired && !r.pending

// Primeira opção do evento aberto que pode ser escolhida; null se não há evento ou nenhuma serve.
export function autoOption(s: State): number | null {
  if (!s.event) return null
  const i = EVENT_BY_ID[s.event].options.findIndex(o => canChoose(s, o) === null)
  return i < 0 ? null : i
}
