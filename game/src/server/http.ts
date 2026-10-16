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

export const body = async (req: Request) => {
  try { return await req.json() } catch { throw new HttpError(400, 'JSON inválido.') }
}

export const tokenOf = (req: Request) => req.headers.get('x-token') ?? ''
