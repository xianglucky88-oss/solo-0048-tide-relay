import assert from 'node:assert/strict'

const base = 'http://127.0.0.1:4811/api/tide-relay'
const call = async (path, body) => {
  const response = await fetch(`${base}/${path}`, body === undefined ? undefined : {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body)
  })
  const json = await response.json()
  return { status: response.status, json }
}

const chartA = (capacity = 10) => ({
  id: 'two-berth', name: '双站试航图', home: 'harbor', period: 6,
  deadline: 13, capacity, quota: 3,
  stations: [
    { id: 'harbor', name: '港口起航台', x: 20, y: 50, charge: 4 },
    { id: 'beacon', name: '三点信标站', x: 80, y: 50, signal: 3, tune: 1 }
  ],
  lanes: [
    { id: 'fairway', from: 'harbor', to: 'beacon', duration: 2, power: 2, phases: [5, 0], assist: [5] }
  ]
})
const wait = { kind: 'wait' }
const sail = lane => ({ kind: 'sail', lane })
const canonical = [wait, wait, wait, wait, wait, sail('fairway'), { kind: 'tune' }, wait, wait, wait, sail('fairway')]

// 1. 内置夜班 briefing 不受影响
const brief = await call('briefing')
assert.equal(brief.status, 200)
assert.equal(brief.json.course.id, 'outer-reach')
assert.equal(brief.json.imported, false)
console.log('✓ GET briefing 内置夜班正常')

// 2. 导入合法自制航图
const imported = await call('chart', chartA())
assert.equal(imported.status, 200)
assert.equal(imported.json.imported, true)
assert.equal(imported.json.course.id, 'two-berth')
assert.ok(imported.json.winningActions <= 50)
console.log(`✓ POST chart 合法航图导入成功（获胜航迹 ${imported.json.winningActions} 条指令）`)

// 3. 容量 3 拒收：422 + unsolvable，且与无效配置区分
const unsolvable = await call('chart', chartA(3))
assert.equal(unsolvable.status, 422)
assert.equal(unsolvable.json.code, 'unsolvable')
console.log('✓ 容量 3 航图按 422 unsolvable 拒收')

// 4. 无效配置：400 + invalid-chart + issues 明细
const bad = chartA()
bad.lanes[0].phases = [5, 6]
const invalid = await call('chart', bad)
assert.equal(invalid.status, 400)
assert.equal(invalid.json.code, 'invalid-chart')
assert.ok(invalid.json.issues.length > 0)
console.log('✓ 相位越界航图按 400 invalid-chart 拒收并附明细')

// 5. v2 自包含实录重放为 65 分（即便当前没有"已导入"状态，陌生浏览器也能重放）
const record = { version: 2, course: 'two-berth', chart: chartA(), actions: canonical }
const replay = await call('replay', record)
assert.equal(replay.status, 200)
assert.equal(replay.json.score.points, 65)
assert.equal(replay.json.state.tick, 13)
assert.equal(replay.json.state.status, 'returned')
assert.equal(replay.json.imported, true)
console.log('✓ v2 自包含实录陌生环境重放为 65 分')

// 6. 未结束 v2 实录可继续下令
const partial = { version: 2, course: 'two-berth', chart: chartA(), actions: [wait, wait] }
const continued = await call('replay', { ...partial, actions: [wait, wait, wait] })
assert.equal(continued.json.state.tick, 3)
assert.equal(continued.json.state.status, 'sailing')
console.log('✓ 未结束 v2 实录可继续下令')

// 7. v1 旧实录照常使用
const go = lane => ({ kind: 'sail', lane })
const k = kind => ({ kind })
const legacyActions = [go('west'), k('tune'), k('wait'), go('crossing'), k('tune'), go('creek'), k('finish')]
const legacy = await call('replay', { version: 1, course: 'outer-reach', actions: legacyActions })
assert.equal(legacy.status, 200)
assert.equal(legacy.json.score.points, 98)
assert.equal(legacy.json.imported, false)
console.log('✓ v1 内置夜班旧实录照常重放为 98 分')

// 8. v2 内嵌航图结构损坏时按 invalid-chart 拒收
const broken = { version: 2, course: 'two-berth', chart: { ...chartA(), home: 'ghost' }, actions: [] }
const brokenReply = await call('replay', broken)
assert.equal(brokenReply.status, 400)
assert.equal(brokenReply.json.code, 'invalid-chart')
console.log('✓ v2 实录内嵌坏航图按 invalid-chart 拒收')

console.log('\nHTTP 端到端检查全部通过。')
