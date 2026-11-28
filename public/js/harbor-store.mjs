const voyageKey = 'tide-relay:v1'
const chartKey = 'tide-relay:chart:v1'

function read(key) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export const loadVoyage = () => read(voyageKey)
export const saveVoyage = trace => write(voyageKey, trace)

export const loadChart = () => read(chartKey)
export const saveChart = chart => write(chartKey, chart)
