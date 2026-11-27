export function start(course) {
  return {
    tick: 0,
    at: course.home,
    power: course.capacity,
    lit: [],
    signals: {},
    status: 'sailing',
    log: []
  }
}
