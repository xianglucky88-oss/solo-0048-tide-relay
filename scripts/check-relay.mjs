// 专项班收发联调规则核验：复现需求中的实录结论，并守住 18 刻夜班旧规则。
// 说明：需求实录的潮刻/余电是叙述性时刻表，受 crossing/north 闭潮和顺逆流耗电约束，
// 引擎内逐刻合法的序列会插入等待或补给；需求给定的计分结论用 score() 锚点精确断言。
import { outerReach } from '../server/course/outer-reach.mjs'
import { outerReachSpecial } from '../server/course/outer-reach-special.mjs'
import { briefing } from '../server/voyage/briefing.mjs'
import { score } from '../server/voyage/score.mjs'
import { laneOpenAt } from '../server/voyage/links.mjs'

const go = lane => ({ kind: 'sail', lane })
const wait = () => ({ kind: 'wait' })
const charge = () => ({ kind: 'charge' })
const finish = () => ({ kind: 'finish' })
const signal = band => ({ kind: 'signal', band })

let failures = 0
function check(name, predicate, detail) {
  if (predicate) {
    console.log(`✓ ${name}`)
  } else {
    failures += 1
    console.error(`✗ ${name}${detail ? ` —— ${detail}` : ''}`)
  }
}

const crossingLane = outerReachSpecial.lanes.find(l => l.id === 'crossing')
const northLane = outerReachSpecial.lanes.find(l => l.id === 'north')
const fullSettings = { reed: 'send', foam: 'receive', shoal: 'send', skerry: 'receive' }
const handover = (tick, signals, power = 1) => ({
  tick, at: 'dock', power, lit: [], status: 'returned', signals, log: []
})

// —— 锚点一：第 14 刻余 1 格交班，只计芦脊—石脊，4 点 107 分 ——
check('crossing 第 14 刻开放、第 13 刻闭潮',
  laneOpenAt(outerReachSpecial, crossingLane, 14) && !laneOpenAt(outerReachSpecial, crossingLane, 13))
const anchored14 = score(outerReachSpecial,
  handover(14, { shoal: 'receive', skerry: 'send', reed: 'receive' }))
check('锚点一 4 点 107 分', anchored14.signal === 4 && anchored14.points === 107,
  JSON.stringify(anchored14))
check('锚点一 仅 crossing 入选、inside 为候选但落选',
  anchored14.links.length === 1 && anchored14.links[0].lane === 'crossing' &&
  anchored14.candidates.some(link => link.lane === 'inside'),
  JSON.stringify(anchored14.links))

// —— 锚点二：早班闭潮当刻只剩石脊—浅湾 2 点，未达标 ——
const closed13 = score(outerReachSpecial,
  handover(13, { shoal: 'receive', skerry: 'send', reed: 'receive' }))
check('第 13 刻 crossing 闭潮剔除芦脊—石脊',
  closed13.signal === 2 && closed13.links.every(link => link.lane !== 'crossing'),
  JSON.stringify(closed13))
check('2 点未达标计 0 分', !closed13.goal && !closed13.won && closed13.points === 0)
const open14 = score(outerReachSpecial,
  handover(14, { shoal: 'receive', skerry: 'send', reed: 'receive' }))
check('同一设置第 14 刻恢复为 4 点', open14.signal === 4)

// —— 锚点三：第 24/26/27 刻三种交班结论 ——
check('north 第 24 刻闭潮、第 26/27 刻开放',
  !laneOpenAt(outerReachSpecial, northLane, 24) &&
  laneOpenAt(outerReachSpecial, northLane, 26) && laneOpenAt(outerReachSpecial, northLane, 27))
check('crossing 第 26 刻开放、第 27 刻闭潮',
  laneOpenAt(outerReachSpecial, crossingLane, 26) && !laneOpenAt(outerReachSpecial, crossingLane, 27))
const s24 = score(outerReachSpecial, handover(24, fullSettings))
check('第 24 刻 仅芦脊—石脊 4 点 87 分',
  s24.signal === 4 && s24.points === 87 &&
  s24.links.length === 1 && s24.links[0].lane === 'crossing', JSON.stringify(s24))
const s26 = score(outerReachSpecial, handover(26, fullSettings))
check('第 26 刻 双链路 6 点 123 分', s26.signal === 6 && s26.points === 123,
  JSON.stringify(s26))
check('第 26 刻 计分 north + inside',
  s26.links.map(link => link.lane).sort().join(',') === 'inside,north')
const s27 = score(outerReachSpecial, handover(27, fullSettings))
check('第 27 刻 双链路 6 点 121 分', s27.signal === 6 && s27.points === 121,
  JSON.stringify(s27))
check('第 27 刻 crossing 闭潮仍取 north + inside',
  s27.links.map(link => link.lane).sort().join(',') === 'inside,north')

// —— 合法重放 A：芦脊—石脊链路（crossing 开放当刻传讯，4 点）——
const replayCrossing = [
  wait(), wait(), wait(), wait(),           // 0→4 等顺流潮
  go('creek'),                               // 4→6 西塘→石脊，顺流耗 2
  signal('send'),                            // 6→8 石脊发讯（tune=2）
  go('crossing'),                            // 8→9 石脊→芦脊，耗 1
  signal('receive'),                         // 9→10 芦脊改收讯
  wait(), wait(), go('crossing'),            // 10→12 等潮，12→13 芦脊→石脊耗 2
  wait(), wait(), wait(),                    // 13→16 等顺流
  go('creek'),                               // 16→18 石脊→西塘，顺流耗 2
  wait(), wait(), wait(), wait(),            // 18→22
  wait(), wait(), wait(), wait(), finish()   // 22→26 交班（crossing 相位2开放）
]
const rc = briefing(outerReachSpecial, replayCrossing)
check('重放A 无拒绝且已交班', rc.rejected === null && rc.state.status === 'returned',
  JSON.stringify(rc.rejected))
check('重放A 第 26 刻交班', rc.state.tick === 26, `tick=${rc.state.tick}`)
check('重放A 芦脊收/石脊发 链路 4 点', rc.score.signal === 4 &&
  rc.score.links[0]?.lane === 'crossing', JSON.stringify(rc.score))
check('重放A 链路方向 发石脊→芦脊收',
  rc.score.links[0]?.sender === 'skerry' && rc.score.links[0]?.receiver === 'reed')

// —— 合法重放 B：石脊—浅湾链路（inside 全潮开放，2 点，未达标）——
const replayInside = [
  go('creek'),                               // 0→2 耗 3
  go('inside'),                              // 2→3 石脊→浅湾耗 2
  signal('receive'),                         // 3→4 浅湾收讯
  go('inside'),                              // 4→5 顺流耗 1 回石脊
  signal('send'),                            // 5→7 石脊发讯
  wait(), wait(), wait(),                    // 7→10 等顺流潮
  go('creek'),                               // 10→12 顺流耗 2 回西塘
  finish()
]
const ri = briefing(outerReachSpecial, replayInside)
check('重放B 无拒绝已交班', ri.rejected === null && ri.state.status === 'returned',
  JSON.stringify(ri.rejected))
check('重放B 仅 inside 2 点未达标',
  ri.score.signal === 2 && ri.score.links[0].lane === 'inside' && !ri.score.won,
  JSON.stringify(ri.score))

// —— 合法重放 C：实录二全程（含东灯连充两次），抵港后等待至 26/27 刻 ——
const replayFull = [
  go('west'),                                // 0→2 芦脊耗 3
  signal('send'),                            // 2→3 芦脊发讯（tune=1）
  wait(), wait(), wait(), wait(),            // 3→7 等 north 潮窗（起刻 7 相位1）
  go('north'),                               // 7→9 芦脊→沫口，顺流耗 2
  signal('receive'),                         // 9→11 沫口收讯（tune=2）
  go('white'),                               // 11→12 沫口→东灯耗 3
  charge(), charge(),                        // 12→13、13→14 连充两次至满电
  wait(), go('east'),                        // 14→15 等，15→17 东灯→浅湾耗 3
  signal('send'),                            // 17→18 浅湾发讯（tune=1）
  go('inside'),                              // 18→19 浅湾→石脊耗 3
  signal('receive'),                         // 19→21 石脊收讯（tune=2）
  wait(), go('creek'),                       // 21→22 等，22→24 顺流回西塘耗 2
]
const rf = briefing(outerReachSpecial, replayFull)
check('重放C 航行段无拒绝、第 24 刻抵港',
  rf.rejected === null && rf.state.at === 'dock' && rf.state.tick === 24,
  JSON.stringify(rf.rejected ?? { at: rf.state.at, tick: rf.state.tick }))
check('重放C 东灯双充后满电出发', rf.state.log.some((item, i) =>
  item.kind === 'charge' && rf.state.log[i - 1]?.kind === 'charge'))
const rf24 = briefing(outerReachSpecial, [...replayFull, finish()])
check('重放C 第 24 刻即时交班 4 点', rf24.score.signal === 4 &&
  rf24.score.links[0].lane === 'crossing', JSON.stringify(rf24.score))
const rf26 = briefing(outerReachSpecial, [...replayFull, wait(), wait(), finish()])
check('重放C 第 26 刻主动交班 6 点',
  rf26.state.tick === 26 && rf26.state.status === 'returned' && rf26.score.signal === 6,
  JSON.stringify(rf26.state))
const rf27 = briefing(outerReachSpecial, [...replayFull, wait(), wait(), wait()])
check('重放C 第 27 刻自动结班 6 点',
  rf27.state.tick === 27 && rf27.state.status === 'returned' && rf27.score.signal === 6,
  `tick=${rf27.state.tick} status=${rf27.state.status}`)
check('重放C 26 与 27 刻得分差 2 分（剩余刻数）',
  rf26.score.points - rf27.score.points === 2)

// —— 链路匹配：每标至多一条，取合计最高 ——
const matched = score(outerReachSpecial, handover(26, {
  reed: 'send', foam: 'receive', skerry: 'receive', shoal: 'send'
}, 5))
const usedStations = matched.links.flatMap(link => [link.from, link.to])
check('匹配 每标至多一条', new Set(usedStations).size === usedStations.length,
  JSON.stringify(matched.links))
check('匹配 取合计最高 6 点（north 4 + inside 2，弃 crossing 4）',
  matched.signal === 6 &&
  matched.links.map(link => link.lane).sort().join(',') === 'inside,north',
  JSON.stringify(matched.links))
check('无链路计零', score(outerReachSpecial, handover(10, {})).signal === 0 &&
  score(outerReachSpecial, handover(10, {})).points === 0)
check('同频两标不相连', score(outerReachSpecial,
  handover(26, { reed: 'send', skerry: 'send' })).signal === 0)

// —— 收发设置动作规则 ——
const dup = briefing(outerReachSpecial, [go('creek'), signal('send'), signal('send')])
check('重复同频拒绝且保持原状态', dup.rejected?.code === 'signal' && dup.state.tick === 4,
  JSON.stringify(dup.rejected))
const reband = briefing(outerReachSpecial, [
  go('creek'),                                // 0→2 石脊
  signal('send'),                             // 2→4 石脊发
  signal('receive'),                          // 4→6 改收
  go('creek'), finish()                       // 6→8 回港交班
])
check('改频完成才采用新设置',
  reband.rejected === null && reband.state.signals.skerry === 'receive' &&
  reband.state.tick === 8 && reband.score.signal === 0,
  JSON.stringify(reband.rejected ?? reband.state))
const oneSet = briefing(outerReachSpecial, [go('creek'), signal('send')])
check('设置耗时沿用原 tune 时长（石脊 tune=2）', oneSet.state.tick === 4)
check('设置耗一格电（顺流航行耗 1 后余 8）', oneSet.state.power === 8)
// 在浅湾反复改频（tune=1、每次 1 电），第 9 次设置时无电可付。
const drained = briefing(outerReachSpecial, [
  go('creek'), go('inside'),                  // 0→3 浅湾，余 8 电
  ...Array.from({ length: 9 }, (_, i) => signal(i % 2 === 0 ? 'send' : 'receive'))
])
check('无电拒绝设置', drained.rejected?.code === 'power' && drained.state.power === 0,
  JSON.stringify(drained.rejected ?? { power: drained.state.power }))
check('起航台不能设置收发',
  briefing(outerReachSpecial, [signal('send')]).rejected?.code === 'beacon')

// —— 旧 18 刻夜班规则保持不变 ——
const legacy = briefing(outerReach, [
  go('west'), { kind: 'tune' }, wait(), go('crossing'),
  { kind: 'tune' }, go('creek'), finish()
])
check('夜班旧规则 98 分仍成立', legacy.score.won && legacy.score.points === 98,
  `points=${legacy.score.points}`)
check('夜班 18 刻在港自动结束为 returned',
  briefing(outerReach, Array.from({ length: 18 }, wait)).state.status === 'returned')
check('夜班 18 刻在外未归为 expired',
  briefing(outerReach, [go('west'), ...Array.from({ length: 16 }, wait)])
    .state.status === 'expired')
check('夜班拒绝 signal', briefing(outerReach, [go('west'), signal('send')]).rejected?.code === 'mode')
check('专项班拒绝 tune',
  briefing(outerReachSpecial, [go('creek'), { kind: 'tune' }]).rejected?.code === 'mode')
check('专项班保留靠岸补给且充电不上溢', (() => {
  // 长途到东灯后余 5 电：一次补到容量上限，满电后第二次按补给规则拒绝。
  const low = [
    go('creek'), go('crossing'),             // 0→3 芦脊
    wait(), wait(), wait(), wait(), go('north'), // 3→7 等潮，7→9 沫口
    go('white'),                             // 9→10 东灯
    ...Array.from({ length: 5 }, wait)       // 10→15
  ]
  const arrived = briefing(outerReachSpecial, low)
  const once = briefing(outerReachSpecial, [...low, charge()])
  const twice = briefing(outerReachSpecial, [...low, charge(), charge()])
  // 西塘起航台同样可补给：两次往返耗电至 6，连充两次（6→10 即触顶，
  // 第二次按上限拒绝），验证补给累计与不上溢。
  const dockRun = [
    go('creek'), go('creek'),                // 两次往返，余 6 电、回到起航台
    charge()
  ]
  const dock = briefing(outerReachSpecial, dockRun)
  const dockFull = briefing(outerReachSpecial, [...dockRun, charge()])
  return arrived.rejected === null && arrived.state.power === 5 &&
    once.state.power === outerReachSpecial.capacity &&
    twice.rejected?.code === 'charge' &&
    dock.rejected === null && dock.state.power === outerReachSpecial.capacity &&
    dockFull.rejected?.code === 'charge'
})())
check('期限 18 vs 27', outerReach.deadline === 18 && outerReachSpecial.deadline === 27)
check('两班共用同一航图',
  outerReachSpecial.stations === outerReach.stations &&
  outerReachSpecial.lanes === outerReach.lanes)

// —— 回放确定性与记录还原（设置、改频、交班刻、计分链路）——
const record = [...replayFull, wait(), wait(), finish()]
const replayA = briefing(outerReachSpecial, record)
const replayB = briefing(outerReachSpecial, JSON.parse(JSON.stringify(record)))
check('专项记录重放确定', JSON.stringify(replayA) === JSON.stringify(replayB))
check('重放还原全部收发设置',
  JSON.stringify(replayA.state.signals) === JSON.stringify(fullSettings))
check('重放还原交班刻与链路',
  replayA.state.tick === 26 &&
  replayA.score.links.map(link => link.lane).sort().join(',') === 'inside,north')
check('日志保留改频 band',
  replayA.state.log.filter(item => item.kind === 'signal').length === 4 &&
  replayA.state.log.some(item => item.kind === 'signal' && item.band === 'receive'))

if (failures) {
  console.error(`\n${failures} 项核验未通过。`)
  process.exit(1)
}
console.log('\n全部专项班核验通过。')
