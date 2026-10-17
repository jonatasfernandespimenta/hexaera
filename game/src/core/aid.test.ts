import { expect, test } from 'vitest'
import { AID_MARKUP, aidOffer, takeAid } from './aid'
import { buyPrice, income, newGame, type State } from './game'

// Era 1, pop alto e sem comida: fome projetada.
const hungry = () => {
  const s = newGame(1)
  s.era = 1
  s.pop = 30
  s.res.food = 0
  return s
}
const withEvent = (id: string): State => {
  const s = hungry()
  s.res.food = 500
  s.event = id
  return s
}

test('sem oferta na Primitiva', () => {
  const s = hungry()
  s.era = 0
  expect(aidOffer(s)).toBeNull()
})

test('sem oferta online, com mercado desligado ou já usada', () => {
  const a = hungry(); a.match = {} as any
  const b = hungry(); b.opts = { threats: 1, abundance: 1, pace: 1, market: 'off', era: 0 }
  const c = hungry(); c.aidEra = 1
  const d = hungry(); d.over = 'lost'
  for (const s of [a, b, c, d]) expect(aidOffer(s)).toBeNull()
})

test('save antigo sem aidEra', () => {
  const s = hungry()
  delete s.aidEra
  expect(aidOffer(s)?.kind).toBe('food')
})

test('fome', () => {
  const s = hungry()
  const a = aidOffer(s)!
  const food = -(0 + income(s).food)
  expect(a.kind).toBe('food')
  expect(a.food).toBe(food)
  expect(a.price).toBe(Math.ceil(food * buyPrice(s, 'food') * AID_MARKUP))
})

test('centro tem prioridade sobre fome', () => {
  const s = hungry()
  s.centerHp = 1
  s.invaders = [{ id: 1, at: '1,0', hp: 3, atk: 1, kind: 0 }]
  const a = aidOffer(s)!
  expect(a.kind).toBe('center')
  expect(a.actions).toBe(2)
  expect(a.price).toBe(60 * s.era)
})

test('evento: toda opção ruim e alguma custa recurso', () => {
  expect(aidOffer(withEvent('manada'))).toBeNull()
  expect(aidOffer(withEvent('seca'))).toBeNull()
  const a = aidOffer(withEvent('tempestade'))!
  expect(a.kind).toBe('event')
  expect(a.option).toBe(0)
  expect(a.price).toBeGreaterThan(0)
})

test('takeAid de evento: custo pela metade, carta resolvida', () => {
  const s = withEvent('tempestade')
  const a = aidOffer(s)!
  const w = s.res.wood
  const cost = 3 * 2 // EVENT_SCALE[1] = 2
  const r = takeAid(s, a, 'ad')
  expect(r.event).toBeNull()
  expect(r.res.wood).toBe(w - Math.ceil(cost / 2))
  expect(r.aidEra).toBe(1)
})

test('takeAid paga e marca a era', () => {
  const s = hungry()
  s.res.money = 1000
  const a = aidOffer(s)!
  const paid = takeAid(s, a, 'money')
  expect(paid.res.money).toBe(1000 - a.price)
  expect(paid.aidEra).toBe(1)
  expect(takeAid(s, a, 'ad').res.money).toBe(1000)
  expect(takeAid(s, a, 'ad').res.food).toBe(a.food)
})

test('takeAid não cobra duas vezes', () => {
  const s = hungry()
  const a = aidOffer(s)!
  const r = takeAid(s, a, 'ad')
  expect(() => takeAid(r, a, 'ad')).toThrow()
})

test('takeAid sem 💰', () => {
  const s = hungry()
  s.res.money = 0
  expect(() => takeAid(s, aidOffer(s)!, 'money')).toThrow()
})
