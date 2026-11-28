import { apply } from './apply.mjs'
import { RuleViolation } from './deny.mjs'
import { departures } from '../course/departures.mjs'

const keyOf = state => `${state.tick}|${state.at}|${state.power}|${[...state.lit].sort().join(',')}`

function signalOf(course, state) {
  return course.stations.filter(station => state.lit.includes(station.id))
    .reduce((total, station) => total + station.signal, 0)
}

function moves(course, state) {
  const sails = departures(course, state).map(lane => ({ kind: 'sail', lane: lane.id }))
  return [...sails, { kind: 'wait' }, { kind: 'charge' }, { kind: 'tune' }]
}

function ready(course, state) {
  return state.at === course.home && signalOf(course, state) >= course.quota
}

// 按潮刻分桶的 Dijkstra：动作只会让潮刻前进，最早达标即最优。
// accept 命中即返回；expand 为 false 的状态不再展开（例如公布后的边界态）。
function explore(course, from, target, drill, accept, expand = () => true) {
  const buckets = new Map()
  const push = state => {
    if (!buckets.has(state.tick)) buckets.set(state.tick, [])
    buckets.get(state.tick).push(state)
  }
  const seen = new Set([keyOf(from)])
  const parent = new Map([[keyOf(from), null]])
  push(from)
  for (let tick = from.tick; tick <= target; tick++) {
    const bucket = buckets.get(tick)
    if (!bucket) continue
    for (const state of bucket) {
      if (state.tick !== tick) continue
      if (accept(course, state)) {
        const path = []
        let cursor = keyOf(state)
        while (parent.get(cursor)) {
          path.unshift(parent.get(cursor).action)
          cursor = parent.get(cursor).key
        }
        return { state, path }
      }
      if (!expand(state)) continue
      for (const action of moves(course, state)) {
        let next
        try { next = apply(course, state, action, drill) } catch (error) {
          if (error instanceof RuleViolation) continue
          throw error
        }
        if (next.tick > target) continue
        const key = keyOf(next)
        if (seen.has(key)) continue
        seen.add(key)
        parent.set(key, { key: keyOf(state), action })
        push(next)
      }
    }
  }
  return null
}

// 从某状态出发，在给定实况门控下找最早返港交班路径。
function finishPath(course, from, target, drill) {
  const found = explore(course, from, target, drill, ready)
  if (!found) return null
  return { actions: [...found.path, { kind: 'finish' }], arrival: found.state.tick,
    finish: found.state.tick, signal: signalOf(course, found.state), power: found.state.power, at: found.state.at }
}

function drillFor(ex, actual) {
  return { ex, actual }
}

// 公布前先在两案共同门控下走到公布刻，再让各案各自续算。
function guaranteed(course, state, target, drill) {
  const ex = drill.ex
  const branch = current => {
    const branches = {}
    for (const item of ex.arrangements) branches[item.id] = finishPath(course, current, target, drillFor(ex, item.id))
    return branches
  }
  if (state.tick >= ex.announce) {
    // 公布当刻起只按当班实况判断，另一案不再约束。
    const branch = finishPath(course, state, target, { ex, actual: drill.actual })
    return branch ? { common: [], branches: { [drill.actual]: branch }, revealed: drill.actual } : null
  }
  const found = explore(course, state, target, drillFor(ex, 'both'), (course, current) => {
    if (current.tick < ex.announce) return false
    const branches = branch(current)
    return ex.arrangements.every(item => branches[item.id])
  }, // 公布之后的状态只在一案成立，不能再当作两案共同的边界继续展开。
  current => current.tick < ex.announce)
  if (!found) return null
  // 需要重新拿到该边界状态的分支结果，保证与返回的共同指令对应。
  const branches = branch(found.state)
  return { common: found.path, branches }
}

function canSolo(course, state, target, ex, item) {
  // 反事实：假设该案就是实况，公布前也按它单条门控推演，判断“单独有赢法”。
  return Boolean(finishPath(course, state, target, { ex, actual: item.id, forced: item.id }))
}

export function plan(course, state, target, drill) {
  if (!Number.isInteger(target) || target < state.tick || target > course.deadline) {
    return { error: '目标刻必须介于当前潮刻与原交班时限之间。' }
  }
  if (state.status !== 'sailing') {
    return { guarantee: false, target, reason: '这一班已经结束，无法再查询预案。' }
  }
  if (!drill) {
    const solo = finishPath(course, state, target, null)
    return solo
      ? { guarantee: true, target, common: [], branches: { base: solo }, mode: 'normal' }
      : { guarantee: false, target, reason: '按当前站位、余电和信标，这条时限无法保证。', mode: 'normal' }
  }
  const ex = drill.ex
  const names = Object.fromEntries(ex.arrangements.map(item => [item.id, { code: item.code, name: item.name }]))
  if (target < ex.announce) {
    // 目标刻早于公布刻：安排尚未生效，按当前潮窗直接返航即可。
    const solo = finishPath(course, state, target, null)
    return solo
      ? { guarantee: true, target, announce: ex.announce, pending: true, common: [],
        branches: { base: solo }, names, mode: 'drill' }
      : { guarantee: false, target, announce: ex.announce, pending: true,
        reason: '按当前站位、余电和信标，这条时限无法保证。', names, mode: 'drill' }
  }
  const result = guaranteed(course, state, target, drill)
  if (result) {
    return { guarantee: true, target, announce: ex.announce, pending: state.tick < ex.announce,
      common: result.common, branches: result.branches, names, mode: 'drill' }
  }
  const solo = ex.arrangements.filter(item => canSolo(course, state, target, ex, item)).map(item => item.id)
  const bothHaveWays = solo.length === ex.arrangements.length
  return {
    guarantee: false, target, announce: ex.announce, pending: state.tick < ex.announce,
    mode: 'drill', solo, names,
    reason: bothHaveWays
      ? '两种实况各自都有赢法，但公布前找不到两案通用的共同指令，无法事先保证。'
      : '按当前站位、余电和信标，这条时限无法保证。'
  }
}
