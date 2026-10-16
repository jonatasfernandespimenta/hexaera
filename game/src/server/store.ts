// Armazenamento das partidas: Redis (Upstash) em produção, memória em dev/testes.
import { Redis } from '@upstash/redis'
import { HttpError } from './matches'

export type Store = {
  get<T>(k: string): Promise<T | null>
  mget(ks: string[]): Promise<unknown[]> // na ordem das chaves; null onde falta
  set(k: string, v: unknown): Promise<void>
  setnx(k: string, v: unknown): Promise<boolean>
  expire(k: string): Promise<void> // renova o prazo (TTL) da chave
}

const copy = <T>(v: unknown) => JSON.parse(JSON.stringify(v)) as T // imita a serialização do Redis

export function memoryStore(): Store {
  const m = new Map<string, unknown>()
  return {
    async get<T>(k: string) { return m.has(k) ? copy<T>(m.get(k)) : null },
    async mget(ks) { return ks.map(k => (m.has(k) ? copy(m.get(k)) : null)) },
    async set(k, v) { m.set(k, copy(v)) },
    async setnx(k, v) { if (m.has(k)) return false; m.set(k, copy(v)); return true },
    async expire() {}, // memória não expira
  }
}

const TTL = 30 * 86400

// Credenciais do Redis: par UPSTASH_* ou o par KV_* que a integração da Vercel injeta.
export function redisEnv(): { url: string; token: string } | null {
  const e = process.env
  if (e.UPSTASH_REDIS_REST_URL && e.UPSTASH_REDIS_REST_TOKEN) return { url: e.UPSTASH_REDIS_REST_URL, token: e.UPSTASH_REDIS_REST_TOKEN }
  if (e.KV_REST_API_URL && e.KV_REST_API_TOKEN) return { url: e.KV_REST_API_URL, token: e.KV_REST_API_TOKEN }
  return null
}

export function redisStore(cfg: { url: string; token: string }): Store {
  const r = new Redis(cfg)
  return {
    get: async <T>(k: string) => (await r.get<T>(k)) ?? null,
    mget: async ks => r.mget<unknown[]>(...ks),
    set: async (k, v) => { await r.set(k, v, { ex: TTL }) },
    setnx: async (k, v) => (await r.set(k, v, { nx: true, ex: TTL })) === 'OK',
    expire: async k => { await r.expire(k, TTL) },
  }
}

let mem: Store | undefined

// Produção sem Redis falha (503), salvo HEXAERA_MEMORY_STORE=1 (opt-in para `next start` local).
export function getStore(): Store {
  const cfg = redisEnv()
  if (cfg) return redisStore(cfg)
  if (process.env.NODE_ENV === 'production' && process.env.HEXAERA_MEMORY_STORE !== '1')
    throw new HttpError(503, 'Servidor de partidas indisponível.')
  return (mem ??= memoryStore())
}
