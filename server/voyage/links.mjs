// 收发联调链路：交班当刻，相邻两标一发一收且该航道当刻开放即可传讯。
// 每标最多计入一条链路，单条贡献为较弱标值的两倍，取合计最高的一组。

export function laneOpenAt(course, lane, tick) {
  return lane.phases.includes(tick % course.period)
}

function signalValue(course, stationId) {
  return course.stations.find(station => station.id === stationId)?.signal ?? 0
}

function candidateLinks(course, state) {
  const settings = state.signals
  const links = []
  for (const lane of course.lanes) {
    const left = settings[lane.from]
    const right = settings[lane.to]
    if (!left || !right || left === right) continue
    if (!laneOpenAt(course, lane, state.tick)) continue
    const weaker = Math.min(signalValue(course, lane.from), signalValue(course, lane.to))
    links.push({
      lane: lane.id,
      from: lane.from,
      to: lane.to,
      sender: left === 'send' ? lane.from : lane.to,
      receiver: left === 'receive' ? lane.from : lane.to,
      points: weaker * 2
    })
  }
  // 让穷举结果在链路加入顺序变化时仍保持确定。
  links.sort((a, b) => a.lane.localeCompare(b.lane))
  return links
}

function bestMatching(links) {
  let best = { points: 0, links: [] }
  const used = new Set()
  const chosen = []
  const visit = index => {
    if (index === links.length) {
      const points = chosen.reduce((total, link) => total + link.points, 0)
      if (points > best.points) best = { points, links: chosen.map(link => link.lane) }
      return
    }
    visit(index + 1)
    const link = links[index]
    if (!used.has(link.from) && !used.has(link.to)) {
      used.add(link.from); used.add(link.to); chosen.push(link)
      visit(index + 1)
      chosen.pop(); used.delete(link.from); used.delete(link.to)
    }
  }
  visit(0)
  return best
}

export function relayResult(course, state) {
  const candidates = candidateLinks(course, state)
  const best = bestMatching(candidates)
  const chosenLanes = new Set(best.links)
  return {
    candidates: candidates.map(({ lane, points, sender, receiver }) => ({ lane, points, sender, receiver })),
    links: candidates.filter(link => chosenLanes.has(link.lane)),
    points: best.points
  }
}
