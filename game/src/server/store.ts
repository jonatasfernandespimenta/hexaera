// Armazenamento das partidas: Redis (Upstash) em produção, memória em dev/testes.
import { Redis } from '@upstash/redis'

export type Store = {
  get<T>(k: string): Promise<T | null>
  set(k: string, v: unknown): Promise<void>
  setnx(k: string, v: unknown): Promise<boolean>
}

const copy = <T>(v: unknown) => JSON.parse(JSON.stringify(v)) as T // imita a serialização do Redis

export function memoryStore(): Store {
  const m = new Map<string, unknown>()
  return {
    async get<T>(k: string) { return m.has(k) ? copy<T>(m.get(k)) : null },
    async set(k, v) { m.set(k, copy(v)) },
    async setnx(k, v) { if (m.has(k)) return false; m.set(k, copy(v)); return true },
  }
}

const TTL = 30 * 86400

export function redisStore(): Store {
  const r = Redis.fromEnv()
  return {
    get: async <T>(k: string) => (await r.get<T>(k)) ?? null,
    set: async (k, v) => { await r.set(k, v, { ex: TTL }) },
    setnx: async (k, v) => (await r.set(k, v, { nx: true, ex: TTL })) === 'OK',
  }
}

let mem: Store | undefined
let warned = false

export function getStore(): Store {
  if (process.env.UPSTASH_REDIS_REST_URL) return redisStore()
  if (process.env.NODE_ENV === 'production' && !warned) {
    warned = true
    console.warn('UPSTASH_REDIS_REST_URL ausente: usando memória (partidas se perdem).')
  }
  return (mem ??= memoryStore())
}
