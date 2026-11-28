import assert from 'node:assert/strict'
import { validateChart } from '../server/course/chart-schema.mjs'
import { findWinningTrace } from '../server/course/solvable.mjs'
import { briefing } from '../server/voyage/briefing.mjs'
import { trace } from '../server/voyage/trace.mjs'
import { outerReach } from '../server/course/outer-reach.mjs'
import { InputError } from '../server/http/error.mjs'

const wait = { kind: 'wait' }
const tune = { kind: 'tune' }
const sail = lane => ({ kind: 'sail', lane })

function chartA(capacity = 10) {
  return {
    id: 'two-berth', name: '双站试航图', home: 'harbor', period: 6,
    deadline: 13, capacity, quota: 3,
    stations: [
      { id: 'harbor', name: '港口起航台', x: 20, y: 50, charge: 4 },
      { id: 'beacon', name: '三点信标站', x: 80, y: 50, signal: 3, tune: 1 }
    ],
    lanes: [
      { id: 'fairway', from: 'harbor', to: 'beacon', duration: 2, power: 2, phases: [5, 0], assist: [5] }
    ]
  }
}

function chartB() {
  const chart = chartA()
  chart.lanes = [{ id: 'fairway', from: 'harbor', to: 'beacon', duration: 2, power: 2, phases: [1, 2], assist: [1] }]
  return chart
}

// 题目给定的标准航迹：第 5 刻离港、第 7 刻校准、第 11 刻回航、第 13 刻到港自动交班。
// 到港刻恰为时限，引擎按规则自动交班，无需也不能再补发 finish。
const canonical = [
  wait, wait, wait, wait, wait,
  sail('fairway'), tune,
  wait, wait, wait,
  sail('fairway')
]

function run(name, fn) {
  try { fn(); console.log(`✓ ${name}`) } catch (error) {
    console.error(`✗ ${name}`)
    throw error
  }
}

run('图A 结构有效并可在 50 条指令内获胜', () => {
  const course = validateChart(chartA())
  const winning = findWinningTrace(course)
  assert.ok(winning && winning.length <= 50, '应找到获胜航迹')
})

run('图A 标准航迹第 13 刻交班且得 65 分', () => {
  const course = validateChart(chartA())
  const view = briefing(course, canonical)
  assert.equal(view.rejected, null)
  assert.equal(view.state.tick, 13)
  assert.equal(view.state.at, 'harbor')
  assert.equal(view.state.status, 'returned')
  assert.equal(view.score.won, true)
  assert.equal(view.score.points, 65)
  assert.equal(canonical.length, 11)
})

run('图A 第 5 刻离港（相位 5 助顺）、第 7 刻校准、第 11 刻回航', () => {
  const course = validateChart(chartA())
  const view = briefing(course, canonical)
  const [outbound, inbound] = view.state.log.filter(item => item.kind === 'sail')
  assert.equal(outbound.tick, 7)
  assert.equal(outbound.power, 9) // 满电 10，顺流仅耗 1 格
  assert.equal(inbound.tick, 13)
  assert.equal(inbound.power, 5) // 逆流多耗 1 格：基础 2 + 1 = 3
  const tuned = view.state.log.find(item => item.kind === 'tune')
  assert.equal(tuned.tick, 8) // 第 7 刻开始校准、耗时 1 刻
})

run('容量改为 3 格：结构合法但无获胜航迹，按 unsolvable 拒收', () => {
  const course = validateChart(chartA(3)) // 结构层通过
  assert.equal(findWinningTrace(course), null)
  const view = briefing(course, canonical)
  assert.ok(view.rejected, '回程电量不足，标准航迹必然被规则拒绝')
  assert.equal(view.rejected.code, 'power')
})

run('图B（同名同标识，开窗相位 1、2）第 1 刻可离港、第 5 刻不能', () => {
  const course = validateChart(chartB())
  const atTick1 = briefing(course, [wait]).options.find(move => move.action.kind === 'sail')
  assert.equal(atTick1.available, true)
  const atTick5 = briefing(course, [wait, wait, wait, wait, wait]).options
    .find(move => move.action.kind === 'sail')
  assert.equal(atTick5.available, false)
  assert.equal(atTick5.message.includes('潮窗'), true)
})

run('旧图A 的 v2 自包含实录在图B 环境下仍复盘为 65 分', () => {
  const record = { version: 2, course: 'two-berth', chart: chartA(), actions: canonical }
  const { course, actions } = trace(record, outerReach)
  const view = briefing(course, actions)
  assert.equal(view.score.points, 65)
  assert.equal(view.course.lanes[0].phases.join(','), '0,5') // 内嵌的是旧图
})

const invalidCases = [
  ['站点标识重复', () => ({ ...chartA(), stations: [...chartA().stations, { id: 'harbor', name: '重复站' }] })],
  ['航道标识重复', () => {
    const c = chartA()
    c.lanes = [...c.lanes, { ...c.lanes[0], id: 'fairway', to: 'harbor' }]
    return c
  }],
  ['航道引用不存在的站点', () => {
    const c = chartA()
    c.lanes = [{ ...c.lanes[0], to: 'ghost' }]
    return c
  }],
  ['相位越界', () => {
    const c = chartA()
    c.lanes = [{ ...c.lanes[0], phases: [5, 6] }]
    return c
  }],
  ['助流相位越界', () => {
    const c = chartA()
    c.lanes = [{ ...c.lanes[0], assist: [-1] }]
    return c
  }],
  ['航道从无完整开放段', () => {
    const c = chartA()
    c.lanes = [{ ...c.lanes[0], duration: 2, phases: [5, 2] }] // 任意连续两刻都不被覆盖
    return c
  }],
  ['起航台引用不存在的站点', () => ({ ...chartA(), home: 'nowhere' })]
]

for (const [name, build] of invalidCases) {
  run(`无效配置拒收（invalid-chart）：${name}`, () => {
    try {
      validateChart(build())
      throw new Error('应当拒收')
    } catch (error) {
      assert.ok(error instanceof InputError)
      assert.equal(error.code, 'invalid-chart')
      assert.equal(error.status, 400)
      assert.ok(Array.isArray(error.issues) && error.issues.length > 0)
    }
  })
}

run('拒收区分两类错误：unsolvable 与 invalid-chart 不同码不同状态', () => {
  const unsolvable = validateChart(chartA(3))
  assert.equal(findWinningTrace(unsolvable), null)
  try { validateChart({ ...chartA(), home: 'missing' }); throw new Error('应当拒收') }
  catch (error) { assert.equal(error.code, 'invalid-chart'); assert.equal(error.status, 400) }
})

run('内置夜班 v1 旧实录照常重放', () => {
  const go = lane => ({ kind: 'sail', lane })
  const k = kind => ({ kind })
  const data = [go('west'), k('tune'), k('wait'), go('crossing'), k('tune'), go('creek'), k('finish')]
  const record = { version: 1, course: outerReach.id, actions: data }
  const { course, actions } = trace(record, outerReach)
  const view = briefing(course, actions)
  assert.equal(view.score.won, true)
  assert.equal(view.score.points, 98)
})

run('v2 实录未结束航次可继续下令（追加指令后状态推进）', () => {
  const record = { version: 2, course: 'two-berth', chart: chartA(), actions: [wait, wait] }
  const { course, actions } = trace(record, outerReach)
  const before = briefing(course, actions)
  assert.equal(before.state.tick, 2)
  const continued = briefing(course, [...actions, wait])
  assert.equal(continued.state.tick, 3)
})

console.log('\n全部自定义航图校验通过。')
