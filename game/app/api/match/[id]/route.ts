import { viewMatch } from '../../../../src/server/matches'
import { getStore } from '../../../../src/server/store'
import { handle, tokenOf } from '../../../../src/server/http'

export const dynamic = 'force-dynamic'

// Token no cabeçalho x-token.
export const GET = (req: Request, { params }: { params: Promise<{ id: string }> }) =>
  handle(async () => viewMatch(getStore(), (await params).id, tokenOf(req)))
