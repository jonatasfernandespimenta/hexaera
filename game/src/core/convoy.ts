// Comitivas entre as duas cidades: exército (versus), ajuda e carga (coop). Ver plano multiplayer.
import { RES, THREATS, type Bag, type Res } from './data'
import { guard, idle, log, terrainAt, type State } from './game'
import { distance, key, neighbors, parse } from './hex'
import { RIVAL_DISTANCE } from './match'

export type Convoy = {
  id: string; kind: 'army' | 'aid' | 'cargo'; sent: number; arrive: number
  n?: number; power?: number; bag?: Bag // power: índice em THREATS (era do remetente)
}

const SPEED = [1, 2, 3, 3, 6, 6, 6]
export const CARGO_PER_WORKER = [5, 8, 15, 15, 1e9, 1e9, 1e9] // 1e9 = ilimitada

export const travelTurns = (s: State) => Math.ceil(RIVAL_DISTANCE / (s.match!.fast ? 2 : SPEED[s.era]))

function check(s: State, mode: 'coop' | 'versus', n: number) {
  guard(s)
  if (!s.match) throw new Error('Só há comitivas em partida online.')
  if (s.match.mode !== mode) throw new Error(mode === 'versus' ? 'Exércitos só no versus.' : 'Ajuda e cargas só no coop.')
  if (!Number.isInteger(n) || n < 1) throw new Error('Quantidade inválida.')
}

function mk(s: State, kind: Convoy['kind'], extra: Partial<Convoy>): Convoy {
  return { id: `${s.match!.seat}-${s.turn}-${s.nextId++}`, kind, sent: s.turn, arrive: s.turn + travelTurns(s), ...extra }
}

function sendTroops(prev: State, mode: 'coop' | 'versus', kind: 'army' | 'aid', n: number) {
  check(prev, mode, n)
  if (n > prev.troops) throw new Error('Tropas insuficientes.')
  const s = structuredClone(prev)
  s.troops -= n
  return { state: s, convoy: mk(s, kind, kind === 'army' ? { n, power: s.era } : { n }) }
}

export const sendArmy = (s: State, n: number) => sendTroops(s, 'versus', 'army', n)
export const sendAid = (s: State, n: number) => sendTroops(s, 'coop', 'aid', n)

export function sendCargo(prev: State, bag: Bag) {
  const items = (Object.entries(bag) as [Res, number][]).filter(([, v]) => v)
  const total = items.reduce((n, [, v]) => n + v, 0)
  check(prev, 'coop', total)
  if (items.some(([r, v]) => v < 0 || prev.res[r] < v)) throw new Error('Recursos insuficientes.')
  const n = Math.ceil(total / CARGO_PER_WORKER[prev.era])
  if (n > idle(prev)) throw new Error('Faltam 👤 ociosos para carregar.')
  const s = structuredClone(prev)
  for (const [r, v] of items) s.res[r] -= v
  s.away.push({ n, back: s.turn + 2 * travelTurns(s) })
  return { state: s, convoy: mk(s, 'cargo', { bag: Object.fromEntries(items) as Bag }) }
}

// Hex revelado (≠ Centro) mais perto do rival; só com o Centro, revela o vizinho mais perto (muta s).
export function raidHex(s: State): string {
  const rival = s.match!.rival
  const near = (ks: string[]) => ks.reduce((a, b) => (distance(parse(b), rival) < distance(parse(a), rival) ? b : a))
  const known = Object.keys(s.tiles).filter(k => k !== '0,0')
  if (known.length) return near(known)
  const k = near(neighbors({ q: 0, r: 0 }).map(key))
  s.tiles[k] = { terrain: terrainAt(s.seed, parse(k)) }
  return k
}

// Limites de uma comitiva vinda da rede (o servidor recusa e o receive ignora o que passar disso).
export const CONVOY_MAX = { travel: 10, n: 500, cargo: 10_000 }
const KINDS = { versus: ['army'], coop: ['aid', 'cargo'] } as const
const int = (v: unknown, lo: number, hi: number) => Number.isInteger(v) && (v as number) >= lo && (v as number) <= hi

// Comitiva bem-formada para o modo: tipo, id, turnos e carga dentro dos limites.
export function validConvoy(c: unknown, mode: 'coop' | 'versus'): c is Convoy {
  if (!c || typeof c !== 'object') return false
  const v = c as Record<string, unknown>
  if (!(KINDS[mode] as readonly unknown[]).includes(v.kind)) return false
  if (typeof v.id !== 'string' || v.id.length > 40) return false
  if (!int(v.sent, 0, 1e6) || !int(v.arrive, (v.sent as number) + 1, (v.sent as number) + CONVOY_MAX.travel)) return false
  if (v.kind !== 'cargo') return int(v.n, 1, CONVOY_MAX.n) && (v.kind === 'aid' || int(v.power, 0, THREATS.length - 1))
  if (!v.bag || typeof v.bag !== 'object' || Array.isArray(v.bag)) return false
  const items = Object.entries(v.bag)
  if (!items.every(([r, n]) => Object.hasOwn(RES, r) && int(n, 0, CONVOY_MAX.cargo))) return false
  return items.reduce((a, [, n]) => a + (n as number), 0) <= CONVOY_MAX.cargo
}

// Comitivas inválidas (forjadas pelo outro cliente) são ignoradas: receber nunca lança.
export function receive(prev: State, arrivals: Convoy[]): State {
  const s = structuredClone(prev)
  const mode = s.match?.mode
  for (const c of arrivals) {
    if (!mode || !validConvoy(c, mode)) continue
    if (c.kind === 'army') {
      s.raids.push({ at: raidHex(s), kind: c.power ?? 0, n: c.n ?? 0 })
      log(s, '⚠️ Exército inimigo chega no próximo turno!')
    } else if (c.kind === 'aid') {
      s.troops += c.n ?? 0
      log(s, `🛡️ Chegaram ${c.n} tropas de ajuda!`)
    } else {
      for (const [r, v] of Object.entries(c.bag ?? {}) as [Res, number][]) s.res[r] += v
      log(s, '📦 Chegou uma carga do parceiro!')
    }
  }
  return s
}
