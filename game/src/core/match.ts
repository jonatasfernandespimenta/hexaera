// Partida online: contexto do assento, fronteira neutra e ritmo (ver plano multiplayer).
import { distance, type Hex } from './hex'
import { ERAS } from './data'
import { newGame, type State } from './game'

export type Mode = 'coop' | 'versus'
export type MatchInfo = { mode: Mode; seat: 0 | 1; fast: boolean; rival: Hex } // rival: Centro do outro, em coordenadas locais

export const RIVAL_DISTANCE = 10
// Ritmo rápido (calibrado com o bot, ver bot.playtest.ts): produção ×abundance, metas de era ×pace; obras levam metade dos turnos.
export const FAST = { abundance: 5, pace: 0.4 }

export function newMatchGame(seed: number, mode: Mode, seat: 0 | 1, fast: boolean): State {
  const s = newGame(seed + seat) // sem opts: isso marcaria 'sandbox'
  s.match = { mode, seat, fast, rival: { q: seat === 0 ? RIVAL_DISTANCE : -RIVAL_DISTANCE, r: 0 } }
  s.opts = { threats: mode === 'versus' ? 0 : 1, abundance: fast ? FAST.abundance : 1, pace: fast ? FAST.pace : 1, market: 'volatil', era: 0 }
  return s
}

// Faixa neutra: hexes a até 2 passos de ficarem equidistantes dos dois Centros não podem ser explorados.
export const neutral = (s: State, h: Hex) => !!s.match && distance(h) >= distance(h, s.match.rival) - 2

// Saves antigos: preenche os campos que não existiam.
export function normalize(s: State): State {
  return { ...s, troops: s.troops ?? 0, away: s.away ?? [], raids: s.raids ?? [] }
}

// Aplica o resultado do rival ao próprio estado (chamado após cada turno fechado). Quem já tem resultado o mantém.
export function settle(s: State, rival: State | null): State {
  if (s.over || !s.match || !rival?.over) return s
  const { mode } = s.match
  if (mode === 'versus' && rival.over === 'lost') return { ...s, over: 'won' }
  if (mode === 'coop' && rival.over === 'lost') return { ...s, over: 'lost' }
  if (mode === 'coop' && rival.over === 'won' && s.era === ERAS.length - 1) return { ...s, over: 'won' }
  return s
}
