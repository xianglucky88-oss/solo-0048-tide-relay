import { orderNames } from './order-board.mjs'

export function showLog(list, view) {
  const places = new Map(view.course.stations.map(station => [station.id, station.name]))
  list.replaceChildren(...view.state.log.toReversed().map(item => {
    const entry = document.createElement('li')
    entry.textContent = `第 ${item.tick} 刻 · ${orderNames[item.kind]} · ${places.get(item.at)} · 余电 ${item.power}`
    return entry
  }))
}
