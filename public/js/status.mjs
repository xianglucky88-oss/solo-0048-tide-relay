export function showStatus(view) {
  const { state, score, course, phase } = view
  document.querySelector('#clock').textContent = `${state.tick} / ${course.deadline} 刻 · ${phase.label}`
  document.querySelector('#power').textContent = `${state.power} / ${course.capacity}`
  document.querySelector('#signal').textContent = `${score.signal} / ${course.quota}`
  document.querySelector('#berth').textContent = course.stations.find(station => station.id === state.at).name
  document.querySelector('#verdict').textContent = state.status === 'sailing' ? '巡标进行中' :
    score.won ? `接力完成 · ${score.points} 分` : state.status === 'expired' ? '超时未归港' : '已交班 · 信标点数未达标'
}
