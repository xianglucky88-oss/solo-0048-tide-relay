const key = 'tide-relay:v1'

export function loadVoyage() {
  try { return JSON.parse(localStorage.getItem(key)) } catch { return null }
}

export function saveVoyage(trace) {
  try { localStorage.setItem(key, JSON.stringify(trace)) } catch { return false }
  return true
}
