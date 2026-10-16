// Playtest automático: `npm run playtest` (N=200 para mais partidas). Fica fora do `npm test`.
import { defineConfig } from 'vitest/config'

export default defineConfig({ test: { include: ['src/**/*.playtest.ts'], testTimeout: 30 * 60_000 } })
