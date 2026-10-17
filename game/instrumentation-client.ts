// Métricas (PostHog), antes do app carregar. Só em produção; a chave é pública (vai para o navegador de qualquer jeito).
// LGPD: sem cookie — o id anônimo fica no localStorage.
import posthog from 'posthog-js'
import { lang } from './src/i18n'

if (process.env.NODE_ENV === 'production') {
  posthog.init('phc_yW5orZYqQhMayobttqgmZF36htjnGmCHWWrutBF4AGse', {
    api_host: 'https://us.i.posthog.com',
    defaults: '2026-08-30',
    persistence: 'localStorage',
  })
  posthog.register({ lang })
}
