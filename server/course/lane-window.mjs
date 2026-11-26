export function laneWindow(course, lane, tick) {
  for (let offset = 0; offset <= course.period; offset++) {
    const start = tick + offset
    const fits = Array.from({ length: lane.duration }, (_, i) => (start + i) % course.period)
      .every(mark => lane.phases.includes(mark))
    if (fits) return { open: offset === 0, next: start }
  }
  return { open: false, next: null }
}
