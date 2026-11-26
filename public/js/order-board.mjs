export const orderNames = { tune:'校准信标', charge:'靠岸充电', wait:'等候一刻', finish:'返港交班', sail:'航行' }

export function drawOrders(container, view, choose) {
  const labels = new Map(view.course.stations.map(station => [station.id, station.name]))
  container.replaceChildren(...view.options.map(move => {
    const button = document.createElement('button')
    const title = move.target ? `航向${labels.get(move.target)}` : orderNames[move.action.kind]
    const note = document.createElement('small')
    note.textContent = move.available ? `到第 ${move.after.tick} 刻 · 余电 ${move.after.power}` :
      move.next > view.state.tick ? `${move.message} 下次第 ${move.next} 刻` : move.message
    button.textContent = title
    button.append(note)
    button.disabled = !move.available
    button.onclick = () => choose(move.action)
    return button
  }))
}
