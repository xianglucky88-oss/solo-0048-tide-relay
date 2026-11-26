export function phase(course, tick) {
  const index = tick % course.period
  return { index, label: course.weather[index], cycle: Math.floor(tick / course.period) + 1 }
}
