import { createMatch } from '../../../src/server/matches'
import { getStore } from '../../../src/server/store'
import { body, handle } from '../../../src/server/http'

export const dynamic = 'force-dynamic'

export const POST = (req: Request) => handle(async () => createMatch(getStore(), await body(req)))
