import { InputError } from '../http/error.mjs'

const kinds = new Set(['sail', 'tune', 'charge', 'wait', 'finish'])

export function trace(input, courseId) {
  if (input?.version !== 1 || input.course !== courseId || !Array.isArray(input.actions) || input.actions.length > 50) {
    throw new InputError('复盘需要匹配的航次与第 1 版指令记录。')
  }
  const actions = input.actions.map(action => {
    if (!kinds.has(action?.kind) || (action.kind === 'sail' && typeof action.lane !== 'string')) {
      throw new InputError('记录含有无法识别的指令。')
    }
    return action.kind === 'sail' ? { kind: action.kind, lane: action.lane } : { kind: action.kind }
  })
  return { actions, drill: input.drill ?? null }
}
