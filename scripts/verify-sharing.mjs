import assert from 'node:assert/strict'
import { validateChart } from '../server/course/chart-schema.mjs'
import { briefing } from '../server/voyage/briefing.mjs'
import { trace } from '../server/voyage/trace.mjs'
import { outerReach } from '../server/course/outer-reach.mjs'

const wait = { kind: 'wait' }
const sail = lane => ({ kind: 'sail', lane })

const chartA = (phases = [5, 0], assist = [5]) => ({
  id: 'two-berth', name: '双站试航图', home: 'harbor', period: 6,
  deadline: 13, capacity: 10, quota: 3,
  stations: [
    { id: 'harbor', name: '港口起航台', x: 20, y: 50, charge: 4 },
    { id: 'beacon', name: '三点信标站', x: 80, y: 50, signal: 3, tune: 1 }
  ],
  lanes: [{ id: 'fairway', from: 'harbor', to: 'beacon', duration: 2, power: 2, phases, assist }]
})
const canonical = [wait, wait, wait, wait, wait, sail('fairway'), { kind: 'tune' }, wait, wait, wait, sail('fairway')]

// 浏览器 localStorage 的最小内存替身，模拟"陌生浏览器"。
function makeLocalStorage() {
  const map = new Map()
  return {
    getItem: key => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    _dump: () => Object.fromEntries(map)
  }
}

// 1. 在图A 环境中导出一份自包含实录（序列化后即分享文件）。
const storage = makeLocalStorage()
const courseA = validateChart(chartA())
const exportRecord = JSON.parse(JSON.stringify({ version: 2, course: courseA.id, chart: courseA, actions: canonical }))
storage.setItem('tide-relay:v1', JSON.stringify(exportRecord))

// 2. 陌生浏览器：只有这份实录，没有任何已保存航图。仅靠内嵌 chart 重放。
const shared = JSON.parse(storage.getItem('tide-relay:v1'))
const parsed = trace(shared, outerReach)
const replayed = briefing(parsed.course, parsed.actions)
assert.equal(replayed.score.points, 65)
assert.equal(replayed.course.lanes[0].phases.join(','), '0,5')
console.log('✓ 陌生浏览器仅凭分享实录按开赛航图复盘为 65 分')

// 3. 未结束实录：另一台浏览器拿到部分航次，继续下令并按时获胜。
const partialRecord = { ...exportRecord, actions: canonical.slice(0, 6) } // 已离港抵达信标站
const p1 = trace(partialRecord, outerReach)
const mid = briefing(p1.course, p1.actions)
assert.equal(mid.state.at, 'beacon')
assert.equal(mid.state.status, 'sailing')
const continuedActions = [...p1.actions, { kind: 'tune' }, wait, wait, wait, sail('fairway')]
const done = briefing(p1.course, continuedActions)
assert.equal(done.score.won, true)
assert.equal(done.score.points, 65)
console.log('✓ 未结束航次在陌生浏览器可继续下令并最终达标交班')

// 4. 同名同标识的新航图（图B：开窗 1、2）已保存为"当前航图"，载入旧图实录仍按旧图复盘。
const storageB = makeLocalStorage()
const courseB = validateChart(chartA([1, 2], [1]))
storageB.setItem('tide-relay:chart:v1', JSON.stringify(courseB))
const currentChart = JSON.parse(storageB.getItem('tide-relay:chart:v1'))
assert.equal(currentChart.id, courseA.id) // 同名同标识
const oldReplay = trace(shared, outerReach) // shared 内嵌的是图A
const oldView = briefing(oldReplay.course, oldReplay.actions)
assert.equal(oldView.score.points, 65)
assert.equal(oldReplay.course.lanes[0].phases.join(','), '0,5', '实录必须使用内嵌旧图而非当前图B')
// 当前图B 的开局行为：第 1 刻可离港、第 5 刻不能。
const bTick1 = briefing(courseB, [wait]).options.find(m => m.action.kind === 'sail')
const bTick5 = briefing(courseB, [wait, wait, wait, wait, wait]).options.find(m => m.action.kind === 'sail')
assert.equal(bTick1.available, true)
assert.equal(bTick5.available, false)
console.log('✓ 同名同标识新图环境下，旧图实录仍复盘 65 分；新图第 1 刻可离港、第 5 刻不能')

// 5. 刷新恢复：保存的自制航图可独立重建开局（不带任何实录）。
const refreshed = trace({ version: 2, course: courseA.id, chart: courseA, actions: [] }, outerReach)
const fresh = briefing(refreshed.course, refreshed.actions)
assert.equal(fresh.state.tick, 0)
assert.equal(fresh.state.power, 10)
assert.equal(fresh.state.at, 'harbor')
console.log('✓ 刷新后凭保存航图重建满电开局')

console.log('\n浏览器分享与恢复闭环全部通过。')
