import { InputError } from './http/error.mjs'
import { readJson } from './http/read-json.mjs'
import { outerReach } from './course/outer-reach.mjs'
import { findCourse } from './course/registry.mjs'
import { briefing } from './voyage/briefing.mjs'
import { trace } from './voyage/trace.mjs'

function selectedCourse(request) {
  const id = new URL(request.url, 'http://localhost').searchParams.get('course')
  return id ? findCourse(id) ?? null : outerReach
}

export async function route(request, operation) {
  if (operation === 'briefing' && request.method === 'GET') {
    const course = selectedCourse(request)
    if (!course) throw new InputError('找不到该航次。', 404)
    return { body: briefing(course, []) }
  }
  if (operation === 'replay' && request.method === 'POST') {
    const input = await readJson(request, 16000)
    const course = findCourse(input.course)
    if (!course) throw new InputError('找不到该航次。', 404)
    return { body: briefing(course, trace(input, course)) }
  }
  throw new InputError('找不到航次入口。', 404)
}
