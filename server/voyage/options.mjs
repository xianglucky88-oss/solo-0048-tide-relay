import { apply } from './apply.mjs'
import { RuleViolation } from './deny.mjs'
import { departures } from '../course/departures.mjs'

export function options(course, state) {
  if (state.status !== 'sailing') return []
  const moves = departures(course, state).map(({ id, ...lane }) => ({ ...lane, action: { kind: 'sail', lane: id } }))
  if (course.mode === 'relay') {
    moves.push({ action: { kind: 'signal', band: 'send' } }, { action: { kind: 'signal', band: 'receive' } })
  } else {
    moves.push({ action: { kind: 'tune' } })
  }
  moves.push({ action: { kind: 'charge' } }, { action: { kind: 'wait' } }, { action: { kind: 'finish' } })
  return moves.map(move => {
    try {
      const result = apply(course, state, move.action)
      return { ...move, available: true, after: { tick: result.tick, power: result.power } }
    } catch (error) {
      if (!(error instanceof RuleViolation)) throw error
      return { ...move, available: false, message: error.message }
    }
  })
}
