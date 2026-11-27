import { orderNames } from './order-board.mjs'

const bandNames = { send: '发讯', receive: '收讯' }

export function showLog(list, view) {
  const places = new Map(view.course.stations.map(station => [station.id, station.name]))
  list.replaceChildren(...view.state.log.toReversed().map(item => {
    const entry = document.createElement('li')
    const action = item.kind === 'signal'
      ? `${orderNames.signal}·${bandNames[item.band] ?? ''}`
      : orderNames[item.kind]
    entry.textContent = `第 ${item.tick} 刻 · ${action} · ${places.get(item.at)} · 余电 ${item.power}`
    return entry
  }))
}
