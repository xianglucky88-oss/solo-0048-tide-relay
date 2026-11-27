export function showStatus(view) {
  const { state, score, course, phase } = view
  const relay = course.mode === 'relay'
  document.querySelector('#clock').textContent = `${state.tick} / ${course.deadline} 刻 · ${phase.label}`
  document.querySelector('#power').textContent = `${state.power} / ${course.capacity}`
  document.querySelector('#signal').textContent = `${score.signal} / ${course.quota}`
  document.querySelector('#signal-label').textContent = relay ? '链路点数' : '信标点数'
  document.querySelector('#berth').textContent = course.stations.find(station => station.id === state.at).name
  let verdict
  if (state.status === 'sailing') {
    verdict = relay ? '联调进行中' : '巡标进行中'
  } else if (score.won) {
    verdict = `接力完成 · ${score.points} 分`
  } else if (state.status === 'expired') {
    verdict = '超时未归港'
  } else {
    verdict = relay ? '已交班 · 链路点数未达标' : '已交班 · 信标点数未达标'
  }
  document.querySelector('#verdict').textContent = verdict
}
