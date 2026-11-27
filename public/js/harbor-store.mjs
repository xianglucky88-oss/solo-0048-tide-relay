const baseKey = 'tide-relay:v1'

export function loadVoyage(courseId = 'outer-reach') {
  try {
    const record = JSON.parse(localStorage.getItem(`${baseKey}:${courseId}`))
    return record && record.course === courseId ? record : null
  } catch {
    return null
  }
}

export function saveVoyage(trace) {
  try {
    localStorage.setItem(`${baseKey}:${trace.course}`, JSON.stringify(trace))
    return true
  } catch {
    return false
  }
}
