import { InputError } from './http/error.mjs'
import { readJson } from './http/read-json.mjs'
import { outerReach } from './course/outer-reach.mjs'
import { briefing } from './voyage/briefing.mjs'
import { trace } from './voyage/trace.mjs'
import { plan } from './voyage/plan.mjs'
import { parseDrill } from './course/exercises.mjs'

function drillOf(token) {
  if (token === undefined || token === null) return null
  const drill = parseDrill(token)
  if (!drill) throw new InputError('演练标识无法识别。')
  return drill
}

export async function route(request, operation) {
  if (operation === 'briefing' && request.method === 'GET') {
    const token = new URL(request.url, 'http://localhost').searchParams.get('drill')
    return { body: briefing(outerReach, [], drillOf(token)) }
  }
  if (operation === 'replay' && request.method === 'POST') {
    const { actions, drill } = trace(await readJson(request, 16000), outerReach.id)
    return { body: briefing(outerReach, actions, drillOf(drill)) }
  }
  if (operation === 'plan' && request.method === 'POST') {
    const input = await readJson(request, 16000)
    const { actions, drill: token } = trace({ ...input, version: 1, course: outerReach.id }, outerReach.id)
    const drill = drillOf(token)
    const result = briefing(outerReach, actions, drill)
    if (result.rejected) throw new InputError(`第 ${result.rejected.index + 1} 条指令：${result.rejected.message}`)
    return { body: { ...plan(outerReach, result.state, input.target, drill), course: outerReach,
      state: result.state, actual: result.actual } }
  }
  throw new InputError('找不到航次入口。', 404)
}
