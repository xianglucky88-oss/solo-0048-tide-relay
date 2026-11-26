import { InputError } from './http/error.mjs'
import { readJson } from './http/read-json.mjs'
import { outerReach } from './course/outer-reach.mjs'
import { briefing } from './voyage/briefing.mjs'
import { trace } from './voyage/trace.mjs'

export async function route(request, operation) {
  if (operation === 'briefing' && request.method === 'GET') return { body: briefing(outerReach, []) }
  if (operation === 'replay' && request.method === 'POST') {
    const actions = trace(await readJson(request, 16000), outerReach.id)
    return { body: briefing(outerReach, actions) }
  }
  throw new InputError('找不到航次入口。', 404)
}
