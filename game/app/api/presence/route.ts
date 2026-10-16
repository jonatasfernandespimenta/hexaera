import { HttpError } from '../../../src/server/matches'
import { getStore } from '../../../src/server/store'
import { body, handle } from '../../../src/server/http'

export const dynamic = 'force-dynamic'

// Sinal de presença de uma aba do jogo (solo ou online): devolve quantas abas estão ativas.
// ponytail: id gerado no cliente, sem autenticação — é só um contador; dá para inflar com spam.
export const POST = (req: Request) => handle(async () => {
  const { id } = await body(req)
  if (typeof id !== 'string' || !/^[a-z0-9-]{8,40}$/.test(id)) throw new HttpError(400, 'Id inválido.')
  return { count: await getStore().presence(id, Date.now()) }
})
