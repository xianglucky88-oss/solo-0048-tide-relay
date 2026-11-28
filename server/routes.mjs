import { InputError } from './http/error.mjs'
import { readJson } from './http/read-json.mjs'
import { outerReach } from './course/outer-reach.mjs'
import { validateChart } from './course/chart-schema.mjs'
import { findWinningTrace } from './course/solvable.mjs'
import { briefing } from './voyage/briefing.mjs'
import { trace } from './voyage/trace.mjs'

export async function route(request, operation) {
  if (operation === 'briefing' && request.method === 'GET') {
    return { body: { imported: false, ...briefing(outerReach, []) } }
  }
  if (operation === 'chart' && request.method === 'POST') {
    const payload = await readJson(request, 65536)
    // 第一层：结构无效（标识重复、悬空引用、相位越界、航道从无完整开放段等）。
    const course = validateChart(payload)
    // 第二层：结构合法但不存在可在 50 条指令内达标返港的获胜航迹。
    const winning = findWinningTrace(course)
    if (!winning) {
      throw new InputError('航图配置合法，但无法从满电起航在 50 条合法指令内达标并按时返港交班，已拒收。',
        422, { code: 'unsolvable' })
    }
    return { body: { imported: true, winningActions: winning.length, ...briefing(course, []) } }
  }
  if (operation === 'replay' && request.method === 'POST') {
    const { course, actions } = trace(await readJson(request, 65536), outerReach)
    return { body: { imported: course.id !== outerReach.id, ...briefing(course, actions) } }
  }
  throw new InputError('找不到航次入口。', 404)
}
