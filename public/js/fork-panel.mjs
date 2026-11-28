// 重开或跨标签同步出现未裁定分叉时，列出候选航迹供玩家选择。
// 每条候选展示服务端确认的位置、潮刻、电量和已点亮信标。

function beaconNames(view) {
  const names = view.course.stations
    .filter(station => view.state.lit.includes(station.id))
    .map(station => station.name)
  return names.length ? names.join('、') : '尚未点亮信标'
}

export function drawForks(container, views, choose) {
  container.replaceChildren(...views.map((view, index) => {
    const place = view.course.stations.find(station => station.id === view.state.at)
    const card = document.createElement('article')
    const title = document.createElement('h3')
    title.textContent = `候选航迹 ${index + 1} · ${view.state.log.length} 条指令`
    const stats = document.createElement('dl')
    const rows = [
      ['当前位置', place.name],
      ['潮刻', `${view.state.tick} / ${view.course.deadline} 刻`],
      ['电量', `${view.state.power} / ${view.course.capacity} 格`],
      ['信标', beaconNames(view)]
    ]
    for (const [label, value] of rows) {
      const term = document.createElement('dt')
      term.textContent = label
      const detail = document.createElement('dd')
      detail.textContent = value
      stats.append(term, detail)
    }
    const button = document.createElement('button')
    button.textContent = '沿这条航迹继续'
    button.onclick = () => choose(index)
    card.append(title, stats, button)
    return card
  }))
}
