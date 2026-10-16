// i18n: o texto em português é a chave; EN traduz. {0}, {1}… são parâmetros.
// O idioma vem do salvo ou do navegador (pt-BR, pt-PT → pt; resto → en). Trocar recarrega a página.
import { BUILDINGS, CONTRACTS, ERAS, LINKS, RES, TERRAINS, THREATS } from './core/data'
import { EVENTS } from './core/events'
import { EN } from './en'

export type Lang = 'pt' | 'en'
const KEY = 'hexaera.lang'

const saved = () => { try { return localStorage.getItem(KEY) } catch { return null } }
// Sem window (testes no Node) fica pt, para as mensagens do core não mudarem.
export const lang: Lang = typeof window === 'undefined' ? 'pt'
  : (saved() as Lang | null) ?? (navigator.language.toLowerCase().startsWith('pt') ? 'pt' : 'en')

export function setLang(l: Lang) {
  try { localStorage.setItem(KEY, l) } catch { /* sem storage: vale só até recarregar */ }
  location.reload()
}

export const t = (s: string, ...a: (string | number)[]) =>
  (lang === 'en' ? EN[s] ?? s : s).replace(/\{(\d)\}/g, (_, i) => String(a[+i]))

// Conteúdo do jogo (cartas, eras, eventos…) é traduzido uma vez, no lugar, ao carregar.
// ponytail: mutação dos dados; vale porque trocar o idioma recarrega a página.
const tr = (o: any, ...f: string[]) => { for (const k of f) if (typeof o[k] === 'string') o[k] = EN[o[k]] ?? o[k] }
if (lang === 'en') {
  for (const o of Object.values(BUILDINGS)) tr(o, 'name', 'desc')
  for (const o of [...Object.values(RES), ...Object.values(TERRAINS), ...Object.values(LINKS), ...THREATS]) tr(o, 'name')
  for (const o of ERAS) tr(o, 'name', 'center')
  for (const o of CONTRACTS) tr(o, 'client')
  for (const e of EVENTS) { tr(e, 'title', 'text'); for (const o of e.options) tr(o, 'label', 'text') }
}
