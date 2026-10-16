// Partida online no cliente: lógica pura de fase e fechamento de turno (o hook fica em useOnline.ts).
import { receive, type Convoy } from './core/convoy'
import { advanceEra, endTurn, type State } from './core/game'
import { settle } from './core/match'

export type Phase = 'lobby' | 'playing' | 'waiting' | 'close'
type Rival = { state: State | null; sent: Convoy[]; votes: number[] }

export const arrivalsFor = (rivalSent: Convoy[], turn: number) => rivalSent.filter(c => c.arrive === turn)

// Fecha o turno T quando os dois enviaram. As chegadas entram depois do endTurn: o defensor joga T+1
// vendo o aviso ⚠️, e os invasores surgem no endTurn seguinte.
export function closeTurn(prev: State, rival: Rival, myVote: boolean): State {
  const T = prev.turn
  let s = prev
  if (s.match?.mode === 'coop' && myVote && rival.votes.includes(T)) s = advanceEra(s, true) // voto de era é só do coop
  if (!s.over) s = receive(endTurn(s), arrivalsFor(rival.sent, T)) // última era no coop: a vitória encerra aqui
  return settle(s, rival.state)
}

export function phase(me: { turn: number }, rival: { turn: number } | null, local: State): Phase {
  if (!rival) return 'lobby'
  if (me.turn >= local.turn && rival.turn >= local.turn) return 'close'
  if (me.turn === local.turn) return 'waiting'
  return 'playing'
}
