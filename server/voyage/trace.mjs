import { InputError } from '../http/error.mjs'
import { validateChart } from '../course/chart-schema.mjs'

const kinds = new Set(['sail', 'tune', 'charge', 'wait', 'finish'])
const MAX_ACTIONS = 50

function normalizeActions(actions) {
  if (!Array.isArray(actions) || actions.length > MAX_ACTIONS) {
    throw new InputError(`复盘需要合法的 actions 数组，且指令不超过 ${MAX_ACTIONS} 条。`)
  }
  return actions.map(action => {
    if (!action || !kinds.has(action.kind) || (action.kind === 'sail' && typeof action.lane !== 'string')) {
      throw new InputError('记录含有无法识别的指令。')
    }
    return action.kind === 'sail' ? { kind: action.kind, lane: action.lane } : { kind: action.kind }
  })
}

/**
 * 解析实录：
 * - version 1：仅含 course 标识，由 fallbackCourse 提供内置航图（旧夜班实录）。
 * - version 2：chart 内嵌开赛时的完整航图，任何浏览器都能按原航图重放或续玩。
 * 返回 { course, actions }。v2 只做结构校验；可解性只在导入航图入口强制。
 */
export function trace(input, fallbackCourse) {
  if (!input || typeof input !== 'object') throw new InputError('复盘需要 JSON 指令记录。')
  const actions = normalizeActions(input.actions)
  if (input.version === 1) {
    if (input.course !== fallbackCourse.id) {
      throw new InputError('复盘需要匹配的航次与第 1 版指令记录。')
    }
    return { course: fallbackCourse, actions }
  }
  if (input.version === 2) {
    if (input.course !== input.chart?.id) {
      throw new InputError('第 2 版记录的航图标识与内嵌航图不一致。', 400, { code: 'invalid-chart' })
    }
    let course
    try {
      course = validateChart(input.chart)
    } catch (error) {
      if (error instanceof InputError && error.code === 'invalid-chart') {
        throw new InputError(`实录内嵌航图无效：${error.message}`, 400, { code: 'invalid-chart', issues: error.issues })
      }
      throw error
    }
    return { course, actions }
  }
  throw new InputError('不支持的记录版本，请使用第 1 或第 2 版指令记录。')
}
