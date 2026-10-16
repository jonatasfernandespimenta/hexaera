import { beforeEach, expect, test } from 'vitest'
import { memoryStore, type Store } from './store'
import { createMatch, joinMatch, putState, submitTurn, viewMatch } from './matches'
import type { Convoy } from '../core/convoy'
import { newGame } from '../core/game'

let st: Store, id: string, t0: string, t1: string
const a: Convoy = { id: 'c1', kind: 'aid', sent: 1, arrive: 3 }

beforeEach(async () => {
  st = memoryStore()
  const c = await createMatch(st, { mode: 'coop', fast: false, timer: 60, name: 'Ana' })
  id = c.id; t0 = c.token
  t1 = (await joinMatch(st, id, 'Bia')).token
})

test('criar e entrar dá assentos 0 e 1', async () => {
  expect(id).toMatch(/^[a-z0-9]{6}$/)
  const v = await viewMatch(st, id, t0)
  expect(v.seat).toBe(0)
  expect((await viewMatch(st, id, t1)).seat).toBe(1)
  expect(v.meta.names).toEqual(['Ana', 'Bia'])
})

test('terceiro jogador recebe 409 e o assento 1 não muda', async () => {
  await expect(joinMatch(st, id, 'Zé')).rejects.toMatchObject({ status: 409 })
  expect((await viewMatch(st, id, t1)).seat).toBe(1)
})

test('envios simultâneos dos dois não se perdem', async () => {
  await Promise.all([submitTurn(st, id, t0, { turn: 1, sent: [a], vote: false }), submitTurn(st, id, t1, { turn: 1, sent: [], vote: false })])
  const v = await viewMatch(st, id, t0)
  expect([v.me.turn, v.rival!.turn, v.me.sent]).toEqual([1, 1, [a]])
})

test('turno fora de ordem e token errado são recusados', async () => {
  await expect(submitTurn(st, id, t0, { turn: 2, sent: [], vote: false })).rejects.toMatchObject({ status: 409 })
  await expect(submitTurn(st, id, 'x', { turn: 1, sent: [], vote: false })).rejects.toMatchObject({ status: 403 })
  await expect(viewMatch(st, 'nope00', t0)).rejects.toMatchObject({ status: 404 })
})

test('rival sem token na resposta', async () => {
  const v = await viewMatch(st, id, t0)
  expect(v.rival).not.toHaveProperty('token')
  expect(v.rival!.online).toBe(true)
})

test('voto e estado ficam no próprio assento', async () => {
  await submitTurn(st, id, t0, { turn: 1, sent: [], vote: true })
  const s = newGame(1)
  await putState(st, id, t1, s)
  const v = await viewMatch(st, id, t0)
  expect(v.me.votes).toEqual([1])
  expect(v.rival!.state).toEqual(JSON.parse(JSON.stringify(s)))
})

test('entradas inválidas dão 400', async () => {
  await expect(createMatch(st, { mode: 'x' as never, fast: false, timer: 60, name: 'A' })).rejects.toMatchObject({ status: 400 })
  await expect(createMatch(st, { mode: 'coop', fast: false, timer: 45, name: 'A' })).rejects.toMatchObject({ status: 400 })
  await expect(createMatch(st, { mode: 'coop', fast: false, timer: 0, name: '  ' })).rejects.toMatchObject({ status: 400 })
  const c = await createMatch(st, { mode: 'versus', fast: true, timer: 0, name: ' ' + 'x'.repeat(30) })
  expect((await viewMatch(st, c.id, c.token)).meta.names[0]).toHaveLength(20)
})

test('ver a partida durante um envio não apaga o envio', async () => {
  const base = st
  let slow = true // só a primeira leitura do assento 0 (a da visualização) demora
  const delayed: Store = { ...base, async get<T>(k: string) {
    const v = await base.get<T>(k)
    if (slow && k === `m:${id}:s0`) { slow = false; await new Promise(r => setTimeout(r, 30)) }
    return v
  } }
  st = delayed
  await Promise.all([viewMatch(st, id, t0), submitTurn(st, id, t0, { turn: 1, sent: [a], vote: true })])
  const v = await viewMatch(st, id, t0)
  expect(v.me.turn).toBe(1)
  expect(v.me.sent).toEqual([a])
  expect(v.me.votes).toEqual([1])
})
