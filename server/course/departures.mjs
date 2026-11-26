import { phase } from './phase.mjs'
import { laneWindow } from './lane-window.mjs'

export function departures(course, state) {
  return course.lanes.filter(lane => [lane.from, lane.to].includes(state.at)).map(lane => {
    const outbound = lane.from === state.at
    const favorsOutbound = lane.assist.includes(phase(course, state.tick).index)
    const power = Math.max(1, lane.power + (outbound === favorsOutbound ? -1 : 1))
    return { id: lane.id, target: outbound ? lane.to : lane.from, duration: lane.duration,
      power, ...laneWindow(course, lane, state.tick) }
  })
}
