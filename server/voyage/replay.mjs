import { start } from './start.mjs'
import { apply } from './apply.mjs'
import { RuleViolation } from './deny.mjs'

export function replay(course, actions) {
  let state = start(course)
  for (const [index, action] of actions.entries()) {
    try {
      state = apply(course, state, action)
    } catch (error) {
      if (!(error instanceof RuleViolation)) throw error
      return { state, rejected: { index, code: error.code, message: error.message } }
    }
  }
  return { state, rejected: null }
}
