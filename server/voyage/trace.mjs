import { InputError } from '../http/error.mjs'

const kinds = new Set(['sail', 'tune', 'charge', 'wait', 'finish', 'signal'])
const bands = new Set(['send', 'receive'])

export function trace(input, course) {
  if (input?.version !== 1 || input.course !== course.id || !Array.isArray(input.actions) || input.actions.length > 50) {
    throw new InputError('复盘需要匹配的航次与第 1 版指令记录。')
  }
  return input.actions.map(action => {
    if (!kinds.has(action?.kind) || (action.kind === 'sail' && typeof action.lane !== 'string')) {
      throw new InputError('记录含有无法识别的指令。')
    }
    if (action.kind === 'signal' && !bands.has(action.band)) {
      throw new InputError('收发设置需要指明发讯或收讯。')
    }
    if (action.kind === 'sail') return { kind: action.kind, lane: action.lane }
    if (action.kind === 'signal') return { kind: action.kind, band: action.band }
    return { kind: action.kind }
  })
}
