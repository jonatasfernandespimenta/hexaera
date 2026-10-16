import { afterEach, expect, test, vi } from 'vitest'
import { getStore, memoryStore, redisEnv } from './store'

afterEach(() => { vi.unstubAllEnvs() })
const env = (o: Record<string, string | undefined>) => {
  for (const k of ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'KV_REST_API_URL', 'KV_REST_API_TOKEN', 'HEXAERA_MEMORY_STORE'])
    vi.stubEnv(k, o[k] ?? '')
  vi.stubEnv('NODE_ENV', o.NODE_ENV ?? 'test')
}

test('Redis com o par UPSTASH_* ou com o par KV_* (Vercel Marketplace)', () => {
  env({ UPSTASH_REDIS_REST_URL: 'https://u', UPSTASH_REDIS_REST_TOKEN: 'a' })
  expect(redisEnv()).toEqual({ url: 'https://u', token: 'a' })
  env({ KV_REST_API_URL: 'https://k', KV_REST_API_TOKEN: 'b' })
  expect(redisEnv()).toEqual({ url: 'https://k', token: 'b' })
  env({ UPSTASH_REDIS_REST_URL: 'https://u' }) // par incompleto
  expect(redisEnv()).toBeNull()
})

test('produção sem Redis dá 503, salvo opt-in explícito pela memória', () => {
  env({ NODE_ENV: 'production' })
  expect(() => getStore()).toThrow(expect.objectContaining({ status: 503 }))
  env({ NODE_ENV: 'production', HEXAERA_MEMORY_STORE: '1' })
  expect(getStore()).toBeDefined()
  env({ NODE_ENV: 'development' })
  expect(getStore()).toBeDefined()
})

test('memória: mget na ordem das chaves (null se falta) e expire sem efeito', async () => {
  const st = memoryStore()
  await st.set('a', { x: 1 }); await st.set('c', 3)
  expect(await st.mget(['a', 'b', 'c'])).toEqual([{ x: 1 }, null, 3])
  await st.expire('a')
  expect(await st.get('a')).toEqual({ x: 1 })
})
