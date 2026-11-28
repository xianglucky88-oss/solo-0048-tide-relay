// 某状态在某案下的门控：公布前默认两案共同可航；forced 用于单案反事实推演。
export function modeAt(drill, tick) {
  if (!drill) return null
  if (drill.forced) return drill.forced
  return tick < drill.ex.announce ? 'both' : drill.actual
}

// 演练中的航道门控：公布前两案同时开放，公布后只认当班实况。
export function laneGate(course, drill, mode) {
  return (lane, tick) => openIn(course, drill, mode, lane, tick)
}

export function openIn(course, drill, mode, lane, tick) {
  const base = lane.phases.includes(tick % course.period)
  if (!drill) return base
  const ex = drill.ex
  if (mode === 'both') {
    return ex.arrangements.every(item => ruleAt(course, ex, item, lane, tick, base))
  }
  const item = ex.arrangements.find(candidate => candidate.id === mode)
  return item ? ruleAt(course, ex, item, lane, tick, base) : base
}

function ruleAt(course, ex, item, lane, tick, base) {
  if (tick < (item.from ?? ex.announce)) return base
  const rule = item.lanes?.[lane.id]
  if (!rule) return base
  if (rule.closed) return false
  if (rule.open) return rule.open.includes(tick)
  return base
}

// 某案在目标区间的可出航刻：整段每一刻都必须开放。
export function laneStarts(course, ex, item, lane) {
  const starts = []
  for (let tick = ex.announce; tick + lane.duration - 1 <= course.deadline; tick++) {
    const base = at => lane.phases.includes(at % course.period)
    const whole = Array.from({ length: lane.duration }, (_, i) => tick + i)
      .every(at => ruleAt(course, ex, item, lane, at, base(at)))
    if (whole) starts.push(tick)
  }
  return starts
}

export function describeDrill(course, drill, tick) {
  if (!drill) return null
  const ex = drill.ex
  const revealed = tick >= ex.announce
  return {
    id: ex.id,
    name: ex.name,
    announce: ex.announce,
    pending: !revealed,
    revealed: revealed ? drill.actual : null,
    actual: revealed ? ex.arrangements.find(item => item.id === drill.actual) : null,
    arrangements: ex.arrangements.map(item => ({
      id: item.id, code: item.code, name: item.name, detail: item.detail, from: item.from ?? ex.announce,
      forecast: courseForecast(course, ex, item)
    }))
  }
}

function courseForecast(course, ex, item) {
  return course.lanes.map(lane => ({
    id: lane.id, from: lane.from, to: lane.to, duration: lane.duration,
    starts: laneStarts(course, ex, item, lane)
  }))
}
