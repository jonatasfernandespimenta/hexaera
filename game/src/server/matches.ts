// Lógica pura das partidas online sobre um Store. Cada jogador só escreve a própria chave de assento.
import type { Mode } from '../core/match'
import { validConvoy, type Convoy } from '../core/convoy'
import type { State } from '../core/game'
import type { Store } from './store'

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

export type Meta = { id: string; mode: Mode; fast: boolean; timer: number; seed: number; names: [string, string | null] }
export type SeatRec = { token: string; turn: number; state: State | null; sent: Convoy[]; votes: number[]; seen: number }
export type RivalView = Omit<SeatRec, 'token'> & { online: boolean }

const ONLINE_MS = 10_000
const SEEN_MS = 3000 // o seen só é regravado se tiver mais que isso (menos escritas no Redis)
const MAX_SENT = 20
const MAX_STATE = 256_000
const ID = /^[a-z0-9]{6}$/
const ALFA = 'abcdefghijklmnopqrstuvwxyz0123456789'
const kMeta = (id: string) => `m:${id}`
const kSeat = (id: string, s: 0 | 1) => `m:${id}:s${s}`
const kSeen = (id: string, s: 0 | 1) => `m:${id}:s${s}:seen` // chave própria: ver a partida nunca reescreve o assento

const newSeat = (): SeatRec => ({ token: crypto.randomUUID(), turn: 0, state: null, sent: [], votes: [], seen: Date.now() })

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
function obj<T>(v: unknown): T {
  if (!isObj(v)) throw new HttpError(400, 'Corpo inválido.')
  return v as T
}

function cleanName(name: unknown) {
  if (typeof name !== 'string' || !name.trim()) throw new HttpError(400, 'Nome inválido.')
  return name.trim().slice(0, 20)
}

export async function createMatch(st: Store, body: { mode: Mode; fast: boolean; timer: number; name: string }) {
  const o = obj<typeof body>(body)
  if (o.mode !== 'coop' && o.mode !== 'versus') throw new HttpError(400, 'Modo inválido.')
  if (![0, 60, 90].includes(o.timer)) throw new HttpError(400, 'Tempo inválido.')
  const name = cleanName(o.name)
  const rec = newSeat()
  for (let i = 0; i < 5; i++) {
    const id = Array.from(crypto.getRandomValues(new Uint8Array(6)), b => ALFA[b % ALFA.length]).join('')
    const meta: Meta = { id, mode: o.mode, fast: !!o.fast, timer: o.timer, seed: Math.floor(Math.random() * 2 ** 31), names: [name, null] }
    if (!(await st.setnx(kMeta(id), meta))) continue
    await st.set(kSeat(id, 0), rec)
    await st.set(kSeen(id, 0), Date.now())
    return { id, seat: 0 as const, token: rec.token }
  }
  throw new HttpError(500, 'Não foi possível criar a partida.')
}

// Toda rota passa por aqui: id fora do formato nunca vira chave (ex.: "<id>:s1").
function checkId(id: unknown): asserts id is string {
  if (typeof id !== 'string' || !ID.test(id)) throw new HttpError(404, 'Partida não encontrada.')
}

async function getMeta(st: Store, id: string) {
  checkId(id)
  const meta = await st.get<Meta>(kMeta(id))
  if (!meta) throw new HttpError(404, 'Partida não encontrada.')
  return meta
}

export async function joinMatch(st: Store, id: string, name: string) {
  const meta = await getMeta(st, id)
  const n = cleanName(name)
  const rec = newSeat()
  if (!(await st.setnx(kSeat(id, 1), rec))) throw new HttpError(409, 'Partida cheia.')
  await st.set(kSeen(id, 1), Date.now())
  meta.names[1] = n
  await st.set(kMeta(id), meta)
  return { seat: 1 as const, token: rec.token }
}

// Uma leitura só (MGET): meta, os dois assentos e os dois seen.
async function auth(st: Store, id: string, token: unknown) {
  checkId(id)
  const [meta, a, b, sa, sb] = (await st.mget([kMeta(id), kSeat(id, 0), kSeat(id, 1), kSeen(id, 0), kSeen(id, 1)])) as
    [Meta | null, SeatRec | null, SeatRec | null, number | null, number | null]
  if (!meta) throw new HttpError(404, 'Partida não encontrada.')
  if (a) a.seen = sa ?? 0
  if (b) b.seen = sb ?? 0
  const recs = [a, b]
  const seat = typeof token === 'string' && token ? ([0, 1] as const).find(s => recs[s]?.token === token) : undefined
  if (seat === undefined) throw new HttpError(403, 'Token inválido.')
  return { meta, seat, me: recs[seat]!, rival: recs[1 - seat] ?? null }
}

export async function viewMatch(st: Store, id: string, token: string) {
  const { meta, seat, me, rival } = await auth(st, id, token)
  const now = Date.now()
  if (now - me.seen >= SEEN_MS) {
    me.seen = now
    await st.set(kSeen(id, seat), now)
  }
  let r: RivalView | null = null
  if (rival) {
    const { token: _t, ...pub } = rival
    r = { ...pub, online: Date.now() - rival.seen < ONLINE_MS }
  }
  return { meta, seat, me, rival: r }
}

// Valida o turno antes de gravar: as comitivas rodam no cliente do outro jogador.
export async function submitTurn(st: Store, id: string, token: string, body: { turn: number; sent: Convoy[]; vote: boolean }) {
  const { meta, seat, me } = await auth(st, id, token)
  const b = obj<typeof body>(body)
  if (!Number.isInteger(b.turn) || typeof b.vote !== 'boolean') throw new HttpError(400, 'Turno inválido.')
  if (!Array.isArray(b.sent) || b.sent.length > MAX_SENT) throw new HttpError(400, 'Envios inválidos.')
  if (!b.sent.every(c => validConvoy(c, meta.mode) && c.sent === b.turn)) throw new HttpError(400, 'Comitiva inválida.')
  if (b.turn !== me.turn + 1) throw new HttpError(409, 'Turno fora de ordem.')
  me.turn = b.turn
  me.sent.push(...b.sent)
  if (b.vote) me.votes.push(b.turn)
  await st.set(kSeat(id, seat), me)
  await st.expire(kMeta(id))
}

export async function putState(st: Store, id: string, token: string, state: State) {
  const { seat, me } = await auth(st, id, token)
  if (!isObj(state)) throw new HttpError(400, 'Estado inválido.')
  if (JSON.stringify(state).length > MAX_STATE) throw new HttpError(413, 'Estado grande demais.')
  me.state = state
  await st.set(kSeat(id, seat), me)
  await st.expire(kMeta(id))
}
