import { relayResult } from './links.mjs'

function beaconScore(course, state, returned) {
  const signal = course.stations.filter(station => state.lit.includes(station.id))
    .reduce((total, station) => total + station.signal, 0)
  const goal = signal >= course.quota
  return { signal, goal, won: goal && returned,
    points: goal && returned ? signal * 20 + (course.deadline - state.tick) * 2 + state.power : 0 }
}

function relayScore(course, state, returned) {
  const result = relayResult(course, state)
  const signal = result.points
  const goal = signal >= course.quota
  const points = goal && returned ? signal * 20 + (course.deadline - state.tick) * 2 + state.power : 0
  return {
    signal,
    goal,
    won: goal && returned,
    points,
    links: result.links,
    candidates: result.candidates
  }
}

export function score(course, state) {
  const returned = state.status === 'returned'
  return course.mode === 'relay'
    ? relayScore(course, state, returned)
    : beaconScore(course, state, returned)
}
