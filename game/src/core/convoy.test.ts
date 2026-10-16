import { expect, test } from 'vitest'
import { receive, sendAid, sendArmy, sendCargo, type Convoy } from './convoy'
import { endTurn, idle } from './game'
import { distance, parse } from './hex'
import { newMatchGame } from './match'

const vs = (troops: number) => { const s = newMatchGame(5, 'versus', 0, true); s.troops = troops; return s }
const coop = () => { const s = newMatchGame(5, 'coop', 0, false); s.pop = 6; s.res.wood = 30; return s }
const army = (n = 3, power = 2): Convoy => ({ id: '0-3-0', kind: 'army', sent: 3, arrive: 8, n, power })

test('exército: sai das tropas e chega em 5 turnos no ritmo rápido', () => {
  const { state, convoy } = sendArmy(vs(3), 2)
  expect(state.troops).toBe(1)
  expect(convoy.arrive - convoy.sent).toBe(5)
  expect(convoy.id).toMatch(/^0-1-\d+$/)
})
test('chegada vira aviso e, no turno seguinte, N invasores com a força do atacante', () => {
  const d = receive(vs(0), [army()])
  expect(d.raids).toHaveLength(1)
  const t = endTurn(d)
  expect(t.invaders.filter(i => i.kind === 2)).toHaveLength(3)
  expect(t.raids).toEqual([])
})
test('defensor só com o Centro: invasores surgem ao lado do Centro', () => {
  const d = receive(newMatchGame(9, 'versus', 1, true), [army()])
  expect(distance(parse(d.raids[0].at))).toBe(1)
  expect(d.tiles[d.raids[0].at]).toBeDefined()
})
test('receive é puro e ajuda soma tropas', () => {
  const s = coop(), { convoy } = sendAid(Object.assign(coop(), { troops: 2 }), 2)
  const t = receive(s, [convoy])
  expect([s.troops, t.troops]).toEqual([0, 2])
})
test('carga: carregadores ficam ausentes (sem ✋) e voltam', () => {
  const c = coop()
  const { state, convoy } = sendCargo(c, { wood: 10 })
  expect(idle(state)).toBe(idle(c) - 2) // 10 / 5 na Primitiva
  expect(state.res.wood).toBe(c.res.wood - 10)
  const p = coop()
  expect(receive(p, [convoy]).res.wood).toBe(p.res.wood + 10)
  expect(state.away[0].back).toBe(state.turn + 2 * 10) // 10 turnos de ida na Primitiva lenta
  let s = structuredClone(state); s.away[0].back = s.turn + 2; s.res.food = 99
  s = endTurn(s)
  expect(s.away).toHaveLength(1)
  s.event = null; s = endTurn(s)
  expect(s.away).toEqual([])
})
test('sendArmy no coop e sendAid no versus lançam erro', () => {
  const c = coop(); c.troops = 2
  const v = vs(2)
  expect(() => sendArmy(c, 1)).toThrow()
  expect(() => sendAid(v, 1)).toThrow()
  expect(() => sendCargo(v, { wood: 1 })).toThrow()
  expect(() => sendArmy(vs(1), 2)).toThrow()
})
