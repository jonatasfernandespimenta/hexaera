import type { NextConfig } from 'next'

// StrictMode desligado: o Vite não usava, e o double-mount quebra os portais do drei <Html>
const config: NextConfig = { reactStrictMode: false }
export default config
