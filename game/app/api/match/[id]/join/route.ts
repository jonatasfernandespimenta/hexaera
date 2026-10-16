import { joinMatch } from '../../../../../src/server/matches'
import { getStore } from '../../../../../src/server/store'
import { body, handle } from '../../../../../src/server/http'

export const dynamic = 'force-dynamic'

export const POST = (req: Request, { params }: { params: Promise<{ id: string }> }) =>
  handle(async () => joinMatch(getStore(), (await params).id, (await body(req)).name))
