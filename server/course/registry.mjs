import { outerReach } from './outer-reach.mjs'
import { outerReachSpecial } from './outer-reach-special.mjs'

export const courses = new Map([
  [outerReach.id, outerReach],
  [outerReachSpecial.id, outerReachSpecial]
])

export function findCourse(id) {
  return courses.get(id)
}
