// Chamadas às rotas /api/match e credenciais por partida no localStorage.
import type { Convoy } from './core/convoy'
import type { State } from './core/game'
import type { Mode } from './core/match'
import { t } from './i18n'
import type { Meta, RivalView, SeatRec } from './server/matches'

export type Creds = { seat: 0 | 1; token: string }
export type View = { meta: Meta; seat: 0 | 1; me: SeatRec; rival: RivalView | null }

const KEY = (id: string) => `hexaera.match.${id}`

export function getCreds(id: string): Creds | null {
  try { return JSON.parse(localStorage.getItem(KEY(id)) ?? 'null') } catch { return null }
}
export function setCreds(id: string, c: Creds) {
  try { localStorage.setItem(KEY(id), JSON.stringify(c)) } catch { /* sem storage: só não lembra a partida */ }
}

// Última partida criada/aceita: no CrazyGames a URL não guarda ?match=, então o recarregar volta por aqui.
const LAST = 'hexaera.lastMatch'
export function lastMatch(): string | null {
  try { return localStorage.getItem(LAST) } catch { return null }
}
export function setLastMatch(id: string | null) {
  try { if (id) localStorage.setItem(LAST, id); else localStorage.removeItem(LAST) } catch { /* sem storage */ }
}

// Base da API: vazia na Vercel (mesma origem); URL absoluta no build do CrazyGames (sem / no fim).
export const API = (process.env.NEXT_PUBLIC_API_BASE ?? '').replace(/\/+$/, '')

async function call<T>(method: string, url: string, body?: unknown, token?: string): Promise<T> {
  const headers: Record<string, string> = {}
  if (body !== undefined) headers['content-type'] = 'application/json'
  if (token) headers['x-token'] = token
  const res = await fetch(`${API}${url}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), cache: 'no-store' })
  const data = await res.json().catch(() => null)
  // Erros do servidor vêm em português (texto estável); a tradução é feita aqui, no cliente.
  if (!res.ok) throw new Error(data?.error ? t(data.error) : t('Erro {0}.', res.status))
  return data as T
}

const at = (id: string) => `/api/match/${encodeURIComponent(id)}`

export const create = (o: { mode: Mode; fast: boolean; timer: number; name: string }) =>
  call<{ id: string; seat: 0; token: string }>('POST', '/api/match', o)
export const join = (id: string, name: string) => call<Creds>('POST', `${at(id)}/join`, { name })
export const view = (id: string, token: string) => call<View>('GET', at(id), undefined, token)
export const submit = (id: string, token: string, b: { turn: number; sent: Convoy[]; vote: boolean }) =>
  call<unknown>('POST', `${at(id)}/turn`, b, token).then(() => {})
export const putState = (id: string, token: string, s: State) =>
  call<unknown>('PUT', `${at(id)}/state`, s, token).then(() => {})
