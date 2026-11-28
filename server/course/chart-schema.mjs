import { InputError } from '../http/error.mjs'

const ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/i
const LIMITS = {
  stations: 16, lanes: 32, period: 24, deadline: 200, capacity: 100,
  quota: 100, power: 50, charge: 100, signal: 50, tune: 20
}

const integer = value => Number.isInteger(value)
const text = value => typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 40

function uniqueSorted(values) {
  return [...new Set(values)].sort((a, b) => a - b)
}

function laneEverOpens(lane, period) {
  for (let start = 0; start < period; start++) {
    const covered = Array.from({ length: lane.duration }, (_, index) => (start + index) % period)
    if (covered.every(mark => lane.phases.includes(mark))) return true
  }
  return false
}

function defaultLayout(index, total) {
  const angle = (Math.PI * 2 * index) / Math.max(total, 1) - Math.PI / 2
  return { x: Math.round(50 + 40 * Math.cos(angle)), y: Math.round(50 + 34 * Math.sin(angle)) }
}

/**
 * 校验作者自制航图并规范化为引擎使用的 course 结构。
 * 结构无效时抛 code = "invalid-chart" 的 InputError；可解性由 solvable.mjs 另行判断。
 */
export function validateChart(input) {
  const issues = []
  const complain = message => issues.push(message)
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new InputError('航图配置无效：需要一个 JSON 航图对象。', 400, { code: 'invalid-chart', issues: ['请求体不是航图对象。'] })
  }

  const id = text(input.id) && ID_PATTERN.test(input.id.trim()) ? input.id.trim() : null
  if (id === null) complain('航图标识需为 1-64 位字母、数字、下划线或短横线，且以字母或数字开头。')
  const name = text(input.name) ? input.name.trim() : null
  if (name === null) complain('航图名称需为 1-40 字的非空字符串。')
  const home = typeof input.home === 'string' ? input.home : null
  if (home === null) complain('起航台标识 home 缺失。')

  for (const [field, max] of [['period', LIMITS.period], ['deadline', LIMITS.deadline], ['capacity', LIMITS.capacity], ['quota', LIMITS.quota]]) {
    if (!integer(input[field]) || input[field] < 1 || input[field] > max) {
      complain(`参数 ${field} 需为 1 到 ${max} 之间的整数。`)
    }
  }
  const period = integer(input.period) ? input.period : 6
  const capacity = integer(input.capacity) ? input.capacity : 0
  const deadline = integer(input.deadline) ? input.deadline : 0
  const quota = integer(input.quota) ? input.quota : 0

  let weather = null
  if (input.weather === undefined) weather = Array.from({ length: period }, (_, index) => `相位${index}`)
  else if (!Array.isArray(input.weather) || input.weather.length !== period || input.weather.some(item => !text(item))) {
    complain(`潮表 weather 需恰好提供 ${period} 个非空相位名称。`)
    weather = Array.from({ length: period }, (_, index) => `相位${index}`)
  } else weather = input.weather.map(item => item.trim())

  const stationIds = new Set()
  const stations = []
  if (!Array.isArray(input.stations) || input.stations.length < 2 || input.stations.length > LIMITS.stations) {
    complain(`站点数量需在 2 到 ${LIMITS.stations} 之间。`)
  } else {
    input.stations.forEach((raw, index) => {
      if (!raw || typeof raw !== 'object') { complain(`第 ${index + 1} 个站点不是对象。`); return }
      const station = {}
      if (!text(raw.id) || !ID_PATTERN.test(raw.id.trim())) complain(`第 ${index + 1} 个站点标识不合规。`)
      else if (stationIds.has(raw.id.trim())) complain(`站点标识重复：${raw.id.trim()}。`)
      else { station.id = raw.id.trim(); stationIds.add(station.id) }
      if (!text(raw.name)) complain(`站点 ${raw.id ?? index + 1} 缺少名称。`)
      else station.name = raw.name.trim()
      const layout = defaultLayout(index, input.stations.length)
      station.x = integer(raw.x) && raw.x >= 0 && raw.x <= 100 ? raw.x : layout.x
      station.y = integer(raw.y) && raw.y >= 0 && raw.y <= 100 ? raw.y : layout.y
      if (raw.charge !== undefined) {
        if (!integer(raw.charge) || raw.charge < 1 || raw.charge > LIMITS.charge) complain(`站点 ${raw.id ?? index + 1} 的充电量需为 1 到 ${LIMITS.charge} 的整数。`)
        else station.charge = raw.charge
      }
      if (raw.signal !== undefined) {
        if (!integer(raw.signal) || raw.signal < 1 || raw.signal > LIMITS.signal) complain(`站点 ${raw.id ?? index + 1} 的信标点需为 1 到 ${LIMITS.signal} 的整数。`)
        else station.signal = raw.signal
      }
      if (raw.tune !== undefined) {
        if (!integer(raw.tune) || raw.tune < 1 || raw.tune > LIMITS.tune) complain(`站点 ${raw.id ?? index + 1} 的校准耗时需为 1 到 ${LIMITS.tune} 的整数。`)
        else station.tune = raw.tune
      }
      if (station.signal !== undefined && station.tune === undefined) {
        complain(`信标站点 ${station.id ?? index + 1} 必须给出校准刻数 tune。`)
      }
      if (station.id) stations.push(station)
    })
  }
  if (home !== null && !stationIds.has(home)) complain(`起航台引用了不存在的站点：${home}。`)

  const laneIds = new Set()
  const lanes = []
  if (!Array.isArray(input.lanes) || input.lanes.length < 1 || input.lanes.length > LIMITS.lanes) {
    complain(`航道数量需在 1 到 ${LIMITS.lanes} 之间。`)
  } else {
    input.lanes.forEach((raw, index) => {
      if (!raw || typeof raw !== 'object') { complain(`第 ${index + 1} 条航道不是对象。`); return }
      const lane = {}
      if (!text(raw.id) || !ID_PATTERN.test(raw.id.trim())) complain(`第 ${index + 1} 条航道标识不合规。`)
      else if (laneIds.has(raw.id.trim())) complain(`航道标识重复：${raw.id.trim()}。`)
      else { lane.id = raw.id.trim(); laneIds.add(lane.id) }
      for (const endpoint of ['from', 'to']) {
        if (typeof raw[endpoint] !== 'string' || !stationIds.has(raw[endpoint])) {
          complain(`航道 ${raw.id ?? index + 1} 的 ${endpoint} 引用了不存在的站点。`)
        }
      }
      if (typeof raw.from === 'string' && raw.from === raw.to) complain(`航道 ${raw.id ?? index + 1} 的两端不能是同一站点。`)
      if (integer(raw.duration) && raw.duration >= 1 && raw.duration <= period) lane.duration = raw.duration
      else complain(`航道 ${raw.id ?? index + 1} 的耗时需为 1 到潮周期 ${period} 之间的整数。`)
      if (integer(raw.power) && raw.power >= 1 && raw.power <= LIMITS.power) lane.power = raw.power
      else complain(`航道 ${raw.id ?? index + 1} 的基础耗电需为 1 到 ${LIMITS.power} 的整数。`)
      const phaseList = Array.isArray(raw.phases) ? raw.phases : null
      if (!phaseList || phaseList.length === 0 || phaseList.some(mark => !integer(mark) || mark < 0 || mark >= period)) {
        complain(`航道 ${raw.id ?? index + 1} 的开放相位必须全部落在 0 到 ${period - 1} 之间。`)
        lane.phases = []
      } else lane.phases = uniqueSorted(phaseList)
      if (raw.assist === undefined) lane.assist = []
      else if (!Array.isArray(raw.assist) || raw.assist.some(mark => !integer(mark) || mark < 0 || mark >= period)) {
        complain(`航道 ${raw.id ?? index + 1} 的助流相位越界。`)
        lane.assist = []
      } else lane.assist = uniqueSorted(raw.assist)
      if (lane.id && typeof raw.from === 'string' && stationIds.has(raw.from) &&
          typeof raw.to === 'string' && stationIds.has(raw.to) && lane.duration && lane.phases.length) {
        lane.from = raw.from
        lane.to = raw.to
        if (!laneEverOpens(lane, period)) complain(`航道 ${lane.id} 在整个潮周期内从无完整开放段。`)
        lanes.push(lane)
      }
    })
  }

  if (issues.length) {
    throw new InputError(`航图配置无效：${issues[0]}`, 400, { code: 'invalid-chart', issues })
  }
  return { id, name, home, deadline, capacity, quota, period, weather, stations, lanes }
}
