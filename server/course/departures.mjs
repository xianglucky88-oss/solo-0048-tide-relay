import { phase } from './phase.mjs'
import { openIn, modeAt } from './drill.mjs'

function fits(course, drill, mode, lane, start) {
  return Array.from({ length: lane.duration }, (_, i) => start + i)
    .every(at => openIn(course, drill, mode, lane, at))
}

function search(course, drill, mode, lane, tick) {
  for (let offset = 0; offset <= course.period * 4; offset++) {
    const start = tick + offset
    if (fits(course, drill, mode, lane, start)) return { open: offset === 0, next: start }
  }
  return { open: false, next: null }
}

export function departures(course, state, drill = null) {
  const mode = modeAt(drill, state.tick)
  return course.lanes.filter(lane => [lane.from, lane.to].includes(state.at)).map(lane => {
    const outbound = lane.from === state.at
    const favorsOutbound = lane.assist.includes(phase(course, state.tick).index)
    const power = Math.max(1, lane.power + (outbound === favorsOutbound ? -1 : 1))
    return { id: lane.id, target: outbound ? lane.to : lane.from, duration: lane.duration, power,
      ...search(course, drill, mode, lane, state.tick) }
  })
}

// 候选中最早能整段走通的开放刻，供预案与行动板提示。
export function earliest(course, state, laneId, drill = null) {
  const lane = course.lanes.find(item => item.id === laneId)
  if (!lane) return null
  return search(course, drill, modeAt(drill, state.tick), lane, state.tick)
}
