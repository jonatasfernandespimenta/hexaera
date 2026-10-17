import type { NextConfig } from 'next'

// StrictMode desligado: o Vite não usava, e o double-mount quebra os portais do drei <Html>
// dev: segundo jogador local via 127.0.0.1, storage separado
const config: NextConfig = { reactStrictMode: false, allowedDevOrigins: ['127.0.0.1'] }

// CORS da API para o build do CrazyGames (outra origem). Origem * serve: a API autentica por x-token, não por cookie.
// Sem headers() no build do CrazyGames: output 'export' não suporta.
if (process.env.NEXT_PUBLIC_CRAZY === '1') {
  // Build estático (zip do CrazyGames): caminhos relativos, sem as rotas de API (route.ts fica fora das extensões)
  config.output = 'export'
  config.assetPrefix = './'
  config.pageExtensions = ['tsx']
} else {
  config.headers = async () => [{
    source: '/api/:path*',
    headers: [
      { key: 'Access-Control-Allow-Origin', value: '*' },
      { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,OPTIONS' },
      { key: 'Access-Control-Allow-Headers', value: 'content-type, x-token' },
    ],
  }]
}
export default config
