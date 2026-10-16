import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { memoryStore, type Store } from './store'
import { createMatch, joinMatch, putState, submitTurn, viewMatch } from './matches'
import type { Convoy } from '../core/convoy'
import { newGame } from '../core/game'
import { THREATS } from '../core/data'

let st: Store, id: string, t0: string, t1: string
const a: Convoy = { id: 'c1', kind: 'aid', sent: 1, arrive: 3, n: 2 }

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
  const delayed: Store = { ...base, async mget(ks: string[]) {
    const v = await base.mget(ks)
    if (slow && ks.includes(`m:${id}:s0`)) { slow = false; await new Promise(r => setTimeout(r, 30)) }
    return v
  } }
  st = delayed
  await Promise.all([viewMatch(st, id, t0), submitTurn(st, id, t0, { turn: 1, sent: [a], vote: true })])
  const v = await viewMatch(st, id, t0)
  expect(v.me.turn).toBe(1)
  expect(v.me.sent).toEqual([a])
  expect(v.me.votes).toEqual([1])
})

// ---------- validação do servidor ----------
afterEach(() => { vi.useRealTimers() })
const turn1 = (sent: unknown[], o: object = {}) => ({ turn: 1, sent, vote: false, ...o }) as never
const bad = (p: Promise<unknown>, status = 400) => expect(p).rejects.toMatchObject({ status })

test('id fora do formato dá 404 em toda rota (não alcança as chaves de assento)', async () => {
  await bad(viewMatch(st, `${id}:s1`, t0), 404)
  await bad(joinMatch(st, `${id}:s0`, 'Zé'), 404)
  await bad(submitTurn(st, `${id}:s0`, t0, turn1([])), 404)
  await bad(putState(st, id.toUpperCase(), t0, newGame(1)), 404)
})

test('corpo nulo ou que não é objeto dá 400', async () => {
  await bad(createMatch(st, null as never))
  await bad(submitTurn(st, id, t0, null as never))
  await bad(submitTurn(st, id, t0, [] as never))
  await bad(putState(st, id, t0, null as never))
  await bad(putState(st, id, t0, [1] as never))
})

test('turno não inteiro e voto não booleano dão 400', async () => {
  await bad(submitTurn(st, id, t0, turn1([], { turn: 1.5 })))
  await bad(submitTurn(st, id, t0, turn1([], { turn: '1' })))
  await bad(submitTurn(st, id, t0, turn1([], { vote: 'sim' })))
  await bad(submitTurn(st, id, t0, turn1([], { sent: null })))
})

test('mais de 20 comitivas num turno dá 400', async () => {
  await bad(submitTurn(st, id, t0, turn1(Array.from({ length: 21 }, (_, i) => ({ ...a, id: `c${i}` })))))
  await submitTurn(st, id, t0, turn1(Array.from({ length: 20 }, (_, i) => ({ ...a, id: `c${i}` }))))
})

const coopBad: [string, unknown][] = [
  ['nulo', null],
  ['tipo de outro modo', { ...a, kind: 'army', power: 0 }],
  ['tipo desconhecido', { ...a, kind: 'nuke' }],
  ['id não texto', { ...a, id: 7 }],
  ['id longo', { ...a, id: 'x'.repeat(41) }],
  ['enviada em outro turno', { ...a, sent: 0 }],
  ['chega no próprio turno', { ...a, arrive: 1 }],
  ['chega longe demais', { ...a, arrive: 12 }],
  ['chegada não inteira', { ...a, arrive: 2.5 }],
  ['n zero', { ...a, n: 0 }],
  ['n enorme', { ...a, n: 1e8 }],
  ['n quebrado', { ...a, n: 1.5 }],
  ['ajuda sem n', { id: 'c1', kind: 'aid', sent: 1, arrive: 3 }],
  ['carga sem saco', { id: 'c1', kind: 'cargo', sent: 1, arrive: 3 }],
  ['carga com recurso desconhecido', { id: 'c1', kind: 'cargo', sent: 1, arrive: 3, bag: { gold: 5 } }],
  ['carga negativa', { id: 'c1', kind: 'cargo', sent: 1, arrive: 3, bag: { wood: -5 } }],
  ['carga quebrada', { id: 'c1', kind: 'cargo', sent: 1, arrive: 3, bag: { wood: 1.5 } }],
  ['carga infinita', { id: 'c1', kind: 'cargo', sent: 1, arrive: 3, bag: { wood: Infinity } }],
  ['carga acima de 10000', { id: 'c1', kind: 'cargo', sent: 1, arrive: 3, bag: { wood: 6000, stone: 4001 } }],
]
test.each(coopBad)('coop: comitiva inválida (%s) dá 400', async (_, c) => {
  await bad(submitTurn(st, id, t0, turn1([c])))
  expect((await viewMatch(st, id, t0)).me.turn).toBe(0) // nada gravado
})

test('coop aceita ajuda e carga válidas', async () => {
  const cargo = { id: 'c2', kind: 'cargo', sent: 1, arrive: 11, bag: { wood: 6000, stone: 4000 } }
  await submitTurn(st, id, t0, turn1([a, cargo]))
  expect((await viewMatch(st, id, t0)).me.sent).toHaveLength(2)
})

test('versus: só exército, com força dentro de THREATS', async () => {
  const v = await createMatch(st, { mode: 'versus', fast: true, timer: 0, name: 'Ana' })
  const army = { id: 'v1', kind: 'army', sent: 1, arrive: 6, n: 3, power: 0 }
  await bad(submitTurn(st, v.id, v.token, turn1([a])))
  await bad(submitTurn(st, v.id, v.token, turn1([{ ...army, power: 99 }])))
  await bad(submitTurn(st, v.id, v.token, turn1([{ ...army, power: -1 }])))
  await bad(submitTurn(st, v.id, v.token, turn1([{ ...army, power: 0.5 }])))
  await bad(submitTurn(st, v.id, v.token, turn1([{ ...army, power: undefined }])))
  await bad(submitTurn(st, v.id, v.token, turn1([{ ...army, n: 501 }])))
  await submitTurn(st, v.id, v.token, turn1([army, { ...army, id: 'v2', power: THREATS.length - 1, n: 500 }]))
})

test('estado acima de 256 kB dá 413', async () => {
  const s = { ...newGame(1), log: ['x'.repeat(256_000)] }
  await bad(putState(st, id, t0, s), 413)
})

test('envio e estado renovam o prazo da partida', async () => {
  const touched: string[] = []
  st = { ...st, async expire(k: string) { touched.push(k) } }
  await submitTurn(st, id, t0, turn1([]))
  await putState(st, id, t1, newGame(1))
  expect(touched).toEqual([`m:${id}`, `m:${id}`])
})

test('ver a partida: uma leitura (mget) e o seen só regravado após 3 s', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  const base = st
  const calls = { get: 0, mget: 0, seen: 0 }
  st = {
    ...base,
    async get<T>(k: string) { calls.get++; return base.get<T>(k) },
    async mget(ks: string[]) { calls.mget++; return base.mget(ks) },
    async set(k: string, v: unknown) { if (k.endsWith(':seen')) calls.seen++; return base.set(k, v) },
  }
  await viewMatch(st, id, t0)
  expect(calls).toEqual({ get: 0, mget: 1, seen: 0 }) // seen acabou de ser gravado ao criar
  vi.advanceTimersByTime(3001)
  await viewMatch(st, id, t0)
  expect(calls.seen).toBe(1)
  await viewMatch(st, id, t0)
  expect(calls.seen).toBe(1)
  expect((await viewMatch(st, id, t1)).rival!.online).toBe(true)
})
