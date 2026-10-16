// Adaptador fino das rotas: executa a lógica e converte HttpError em resposta.
import { HttpError } from './matches'

export async function handle(fn: () => Promise<unknown>) {
  try {
    return Response.json((await fn()) ?? { ok: true })
  } catch (e) {
    if (e instanceof HttpError) return Response.json({ error: e.message }, { status: e.status })
    console.error(e)
    return Response.json({ error: 'Erro interno.' }, { status: 500 })
  }
}

// Corpo JSON que é objeto (null, número ou lista → 400).
export const body = async (req: Request) => {
  let v: unknown
  try { v = await req.json() } catch { throw new HttpError(400, 'JSON inválido.') }
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new HttpError(400, 'Corpo inválido.')
  return v as any // eslint-disable-line @typescript-eslint/no-explicit-any -- validado em matches.ts
}

export const tokenOf = (req: Request) => req.headers.get('x-token') ?? ''
