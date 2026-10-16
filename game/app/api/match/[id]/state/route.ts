import { putState } from '../../../../../src/server/matches'
import { getStore } from '../../../../../src/server/store'
import { body, handle, tokenOf } from '../../../../../src/server/http'

export const dynamic = 'force-dynamic'

export const PUT = (req: Request, { params }: { params: Promise<{ id: string }> }) =>
  handle(async () => putState(getStore(), (await params).id, tokenOf(req), await body(req)))
