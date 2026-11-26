export function calendar(course, tick, span = course.period) {
  return Array.from({ length: span }, (_, index) => {
    const at = tick + index
    return { tick: at, label: course.weather[at % course.period] }
  }).filter(slot => slot.tick <= course.deadline)
}
