import { requireRule } from './deny.mjs'

// 到站设置发讯或收讯：付出原校准时长和一格电，也可付出相同代价改频；
// 动作完成后才采用新设置，因此对已采用同一收发设置的站点拒绝重复设置。
export function signalOrder(course, state, band) {
  const station = course.stations.find(item => item.id === state.at)
  requireRule(station.signal, 'beacon', '这里没有可供收发联调的信标。')
  requireRule(state.signals[state.at] !== band, 'signal', `该标已经采用${band === 'send' ? '发讯' : '收讯'}设置。`)
  requireRule(state.power >= 1, 'power', '设置收发至少需要一格电。')
  return {
    cost: 1,
    duration: station.tune,
    signals: { ...state.signals, [state.at]: band },
    band
  }
}
