import { expect, test } from 'vitest'
import { memoryStore, PRESENCE_MS } from './store'

test('presença: conta abas distintas e esquece quem parou de dar sinal', async () => {
  const st = memoryStore()
  expect(await st.presence('aba-um-123', 0)).toBe(1)
  expect(await st.presence('aba-dois-12', 1000)).toBe(2)
  expect(await st.presence('aba-um-123', 2000)).toBe(2) // mesma aba não conta duas vezes
  expect(await st.presence('aba-dois-12', 2000 + PRESENCE_MS + 1)).toBe(1) // aba-um expirou
})
