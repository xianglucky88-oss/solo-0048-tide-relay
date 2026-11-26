export function start(course) {
  return { tick: 0, at: course.home, power: course.capacity, lit: [], status: 'sailing', log: [] }
}
