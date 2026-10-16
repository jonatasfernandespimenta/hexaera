import { expect, test } from 'vitest'
import type { Convoy } from './core/convoy'
import { ERAS } from './core/data'
import { endTurn, type State } from './core/game'
import { newMatchGame } from './core/match'
import { arrivalsFor, closeTurn, phase } from './online'

const rival = (o: Partial<{ turn: number; state: State | null; sent: Convoy[]; votes: number[] }> = {}) =>
  ({ turn: 0, state: null, sent: [], votes: [], ...o })
const aid = (arrive: number, n = 2): Convoy => ({ id: `1-1-${arrive}`, kind: 'aid', sent: 1, arrive, n })
// Fecha o turno sem carta pendente (eventos são resolvidos pelo jogador antes de enviar).
const close = (s: State, r: ReturnType<typeof rival>, vote = false) => ({ ...closeTurn(s, r, vote), event: null })

test('arrivalsFor: só as comitivas que chegam no turno', () => {
  expect(arrivalsFor([aid(2), aid(3), aid(3)], 3).map(c => c.arrive)).toEqual([3, 3])
})

test('chegadas aplicadas uma única vez no turno certo', () => {
  const r = rival({ sent: [aid(2, 2)] })
  let s = newMatchGame(5, 'coop', 0, false)
  s = close(s, r) // turno 1: nada chega
  expect(s.troops).toBe(0)
  s = close(s, r) // turno 2: chega a ajuda
  expect(s.troops).toBe(2)
  s = close(s, r) // turno 3: não chega de novo
  expect(s.troops).toBe(2)
})

test('retomar depois de enviar e antes de subir o estado: fecha o turno ao voltar', () => {
  const local = newMatchGame(5, 'coop', 0, false)
  const me = { turn: local.turn } // já enviou o turno local.turn
  const r = rival({ turn: local.turn })
  expect(phase(me, r, local)).toBe('close')
  expect(closeTurn(local, r, false).turn).toBe(local.turn + 1)
})

test('phase: sala, jogando e esperando', () => {
  const local = newMatchGame(5, 'coop', 0, false) // turno 1
  expect(phase({ turn: 0 }, null, local)).toBe('lobby')
  expect(phase({ turn: 0 }, rival({ turn: 0 }), local)).toBe('playing')
  expect(phase({ turn: 0 }, rival({ turn: 1 }), local)).toBe('playing') // rival já enviou, eu não
  expect(phase({ turn: 1 }, rival({ turn: 0 }), local)).toBe('waiting')
  expect(phase({ turn: 1 }, rival({ turn: 2 }), local)).toBe('close')
})

test('voto dos dois no mesmo turno avança a era nos dois lados', () => {
  const a = newMatchGame(5, 'coop', 0, false), b = newMatchGame(5, 'coop', 1, false)
  expect(closeTurn(a, rival({ votes: [1] }), true).era).toBe(1)
  expect(closeTurn(b, rival({ votes: [1] }), true).era).toBe(1)
  expect(closeTurn(a, rival({ votes: [1] }), false).era).toBe(0) // só o rival votou
  expect(closeTurn(a, rival({ votes: [] }), true).era).toBe(0) // só eu votei
  expect(closeTurn(a, rival({ votes: [2] }), true).era).toBe(0) // voto de outro turno
})

test('rival perdeu no versus → venci ao fechar o turno', () => {
  const s = newMatchGame(5, 'versus', 0, true)
  const lost = { ...newMatchGame(5, 'versus', 1, true), over: 'lost' as const }
  expect(closeTurn(s, rival({ state: lost }), false).over).toBe('won')
})

test('exército que chega em T vira aviso ao fechar T e invasores no turno seguinte', () => {
  const s = newMatchGame(5, 'versus', 0, true)
  const army: Convoy = { id: '1-0-0', kind: 'army', sent: 0, arrive: 1, n: 3, power: 0 }
  const closed = close(s, rival({ sent: [army] }))
  expect(closed.raids).toHaveLength(1)
  expect(closed.invaders).toHaveLength(0)
  const next = endTurn(closed)
  expect(next.raids).toHaveLength(0)
  expect(next.invaders.filter(i => i.at === closed.raids[0].at)).toHaveLength(3)
})

test('versus: votos são ignorados (última era não trava o fechamento)', () => {
  const s = { ...newMatchGame(5, 'versus', 0, true), era: ERAS.length - 1 }
  const closed = closeTurn(s, rival({ votes: [1] }), true)
  expect(closed.turn).toBe(2)
  expect(closed.era).toBe(ERAS.length - 1)
  expect(closed.over).toBeNull()
})

test('coop: voto dos dois na última era vence a partida sem lançar', () => {
  const last = (seat: 0 | 1) => ({ ...newMatchGame(5, 'coop', seat, false), era: ERAS.length - 1 })
  const a = closeTurn(last(0), rival({ votes: [1] }), true)
  const b = closeTurn(last(1), rival({ votes: [1], state: a }), true)
  expect([a.over, b.over]).toEqual(['won', 'won'])
  expect(a.turn).toBe(1) // vitória encerra sem rodar o endTurn
})
