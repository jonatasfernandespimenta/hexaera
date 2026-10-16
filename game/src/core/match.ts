// Partida online: contexto do assento, fronteira neutra e ritmo (ver plano multiplayer).
import { distance, type Hex } from './hex'
import { newGame, type State } from './game'

export type Mode = 'coop' | 'versus'
export type MatchInfo = { mode: Mode; seat: 0 | 1; fast: boolean; rival: Hex } // rival: Centro do outro, em coordenadas locais

export const RIVAL_DISTANCE = 10

export function newMatchGame(seed: number, mode: Mode, seat: 0 | 1, fast: boolean): State {
  const s = newGame(seed + seat) // sem opts: isso marcaria 'sandbox'
  s.match = { mode, seat, fast, rival: { q: seat === 0 ? RIVAL_DISTANCE : -RIVAL_DISTANCE, r: 0 } }
  s.opts = { threats: mode === 'versus' ? 0 : 1, abundance: fast ? 2 : 1, pace: fast ? 0.4 : 1, market: 'volatil', era: 0 }
  return s
}

// Faixa neutra: hexes a até 2 passos de ficarem equidistantes dos dois Centros não podem ser explorados.
export const neutral = (s: State, h: Hex) => !!s.match && distance(h) >= distance(h, s.match.rival) - 2

// Saves antigos: preenche os campos que não existiam.
export function normalize(s: State): State {
  return { ...s, troops: s.troops ?? 0, away: s.away ?? [], raids: s.raids ?? [] }
}
