import type { NextConfig } from 'next'

// StrictMode desligado: o Vite não usava, e o double-mount quebra os portais do drei <Html>
// dev: segundo jogador local via 127.0.0.1, storage separado
const config: NextConfig = { reactStrictMode: false, allowedDevOrigins: ['127.0.0.1'] }
export default config
