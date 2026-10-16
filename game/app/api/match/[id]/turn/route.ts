import { submitTurn } from '../../../../../src/server/matches'
import { getStore } from '../../../../../src/server/store'
import { body, handle, tokenOf } from '../../../../../src/server/http'

export const dynamic = 'force-dynamic'

export const POST = (req: Request, { params }: { params: Promise<{ id: string }> }) =>
  handle(async () => submitTurn(getStore(), (await params).id, tokenOf(req), await body(req)))
