import { apply } from './apply.mjs'
import { RuleViolation } from './deny.mjs'
import { departures } from '../course/departures.mjs'

export function options(course, state, drill = null) {
  if (state.status !== 'sailing') return []
  const moves = departures(course, state, drill).map(({ id, ...lane }) => ({ ...lane, action: { kind: 'sail', lane: id } }))
  for (const kind of ['tune', 'charge', 'wait', 'finish']) moves.push({ action: { kind } })
  return moves.map(move => {
    try {
      const result = apply(course, state, move.action, drill)
      return { ...move, available: true, after: { tick: result.tick, power: result.power } }
    } catch (error) {
      if (!(error instanceof RuleViolation)) throw error
      return { ...move, available: false, message: error.message }
    }
  })
}
