export function score(course, state) {
  const signal = course.stations.filter(station => state.lit.includes(station.id))
    .reduce((total, station) => total + station.signal, 0)
  const returned = state.status === 'returned'
  const goal = signal >= course.quota
  return { signal, goal, won: goal && returned,
    points: goal && returned ? signal * 20 + (course.deadline - state.tick) * 2 + state.power : 0 }
}
