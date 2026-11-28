import { orderNames } from './order-board.mjs'

export function actionLabel(action, view) {
  const place = id => view.course.stations.find(station => station.id === id)?.name ?? id
  if (action.kind !== 'sail') return orderNames[action.kind]
  const lane = view.course.lanes.find(item => item.id === action.lane)
  return lane ? `航行 ${place(lane.from)}→${place(lane.to)}` : `航行 ${action.lane}`
}

function track(list, actions, view) {
  const items = actions.map(action => {
    const entry = document.createElement('li')
    entry.textContent = actionLabel(action, view)
    return entry
  })
  list.replaceChildren(...items)
}

export function showPlan(container, result, view) {
  container.replaceChildren()
  if (!result) { container.hidden = true; return }
  container.hidden = false
  const heading = document.createElement('h3')
  heading.textContent = `目标第 ${result.target} 刻交班`
  container.append(heading)
  const note = document.createElement('p')
  note.className = 'plan-verdict'
  if (result.error) { note.textContent = result.error; container.append(note); return }
  if (result.guarantee) {
    note.textContent = result.pending ? '可以保证 · 公布前先按共同指令走，公布后按当班实况分头返航。' : '可以保证 · 按当前实况返航。'
    container.append(note)
    if (result.pending && result.common.length) {
      const title = document.createElement('h4'); title.textContent = '公布前共同指令'
      const next = document.createElement('p'); next.textContent = `下一条：${actionLabel(result.common[0], view)}`
      const list = document.createElement('ol'); track(list, result.common, view)
      container.append(title, next, list)
    } else if (result.pending) {
      const next = document.createElement('p'); next.textContent = '下一条：可在公布刻直接按各案分头返航。'
      container.append(next)
    }
    const branches = document.createElement('div'); branches.className = 'plan-branches'
    for (const [id, branch] of Object.entries(result.branches)) {
      const card = document.createElement('section'); card.className = 'plan-branch'
      const label = result.names?.[id] ?? { name: id === 'base' ? '当班航迹' : id }
      const head = document.createElement('h4'); head.textContent = `${label.name} · 第 ${branch.finish} 刻交班`
      const list = document.createElement('ol'); track(list, branch.actions, view)
      card.append(head, list); branches.append(card)
    }
    container.append(branches)
    return
  }
  note.textContent = result.reason ?? '这条时限无法保证。'
  note.classList.add('warn')
  container.append(note)
  if (result.solo?.length) {
    const hint = document.createElement('p')
    hint.textContent = `单独来看可行的实况：${result.solo.map(id => result.names?.[id]?.name ?? id).join('、')}。`
    container.append(hint)
  }
}
