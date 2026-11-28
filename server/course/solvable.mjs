import { start } from '../voyage/start.mjs'
import { apply } from '../voyage/apply.mjs'
import { options } from '../voyage/options.mjs'
import { score } from '../voyage/score.mjs'

const ACTION_LIMIT = 50
const STATE_CAP = 30000

function stateKey(state) {
  return `${state.tick}|${state.at}|${state.power}|${state.lit.slice().sort().join(',')}`
}

/**
 * 判定航图是否存在获胜航迹：从满电起航开始，在 50 条合法指令内
 * 集齐达标信标点并按时返港交班。无法证明时返回 null。
 * 全程复用实战引擎 apply/options，保证搜索与对局语义完全一致。
 */
export function findWinningTrace(course) {
  const initial = start(course)
  const seen = new Set([stateKey(initial)])
  const queue = [{ state: initial, actions: [], depth: 0 }]
  while (queue.length) {
    const node = queue.shift()
    if (score(course, node.state).won) return node.actions
    if (node.depth >= ACTION_LIMIT) continue
    for (const move of options(course, node.state)) {
      if (!move.available) continue
      const next = apply(course, node.state, move.action)
      const key = stateKey(next)
      if (seen.has(key)) continue
      seen.add(key)
      if (seen.size > STATE_CAP) return null
      queue.push({ state: next, actions: [...node.actions, move.action], depth: node.depth + 1 })
    }
  }
  return null
}
