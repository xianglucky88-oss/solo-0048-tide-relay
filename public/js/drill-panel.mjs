export function showDrill(container, drill, view) {
  container.replaceChildren()
  if (!drill) {
    container.hidden = true
    return
  }
  container.hidden = false
  const head = document.createElement('h2')
  head.textContent = `${drill.name} · 第 ${drill.announce} 刻公布实况`
  const note = document.createElement('p')
  note.className = 'drill-note'
  note.textContent = drill.pending
    ? '公布前，每条指令都必须在两种安排下同时合法，跨公布刻的航段整段检查。'
    : `实况已公布：${drill.actual?.name ?? ''}。公布当刻起按实况指挥，仍不能中途插令。`
  container.append(head, note)
  const grid = document.createElement('div')
  grid.className = 'drill-arrangements'
  for (const item of drill.arrangements) {
    const card = document.createElement('section')
    card.className = 'drill-card'
    if (drill.revealed === item.id) card.classList.add('actual')
    if (drill.revealed && drill.revealed !== item.id) card.classList.add('muted')
    const title = document.createElement('h3')
    title.textContent = item.name
    const detail = document.createElement('p')
    detail.textContent = item.detail
    card.append(title, detail)
    const windowList = document.createElement('ul')
    windowList.className = 'drill-windows'
    for (const lane of item.forecast ?? []) {
      if (!lane.starts.length) continue
      const place = id => view.course.stations.find(station => station.id === id)?.name ?? id
      const row = document.createElement('li')
      row.textContent = `${place(lane.from)}→${place(lane.to)}：第 ${lane.starts.join('、')} 刻起航`
      windowList.append(row)
    }
    card.append(windowList)
    grid.append(card)
  }
  container.append(grid)
}
