import { request } from './request.mjs'
import { download } from './download.mjs'
import { loadVoyage, saveVoyage } from './harbor-store.mjs'
import { drawMap } from './map.mjs'
import { drawOrders } from './order-board.mjs'
import { showCalendar } from './calendar.mjs'
import { showLog } from './log.mjs'
import { showStatus } from './status.mjs'
import { showDrill } from './drill-panel.mjs'
import { showPlan } from './plan-panel.mjs'

const q = selector => document.querySelector(selector)
let voyage, busy = false
let exercises = []
const message = text => { q('#message').textContent = text }

function display(view, record, persist = true) {
  voyage = record
  showStatus(view)
  drawMap(q('#chart'), view)
  drawOrders(q('#orders'), view, action => transition({ ...voyage, actions: [...voyage.actions, action] }))
  showDrill(q('#drill'), view.drill, view)
  showCalendar(q('#calendar'), view.calendar)
  showLog(q('#log'), view)
  message(!persist || saveVoyage(record) ? '' : '浏览器无法保留航次，仍可下载指令记录。')
  for (const id of ['#reset', '#export', '#import', '#plan-form', '#drill-choice']) q(id).disabled = false
  const exerciseId = record?.drill ? record.drill.split(':')[0] : ''
  q('#drill-choice').value = exerciseId
  q('#target').max = String(view.course.deadline)
  q('#target').min = String(view.state.tick)
  if (q('#target').value === '') q('#target').value = String(view.course.deadline)
  if (view.state.status !== 'sailing') {
    q('#plan').hidden = true
    q('#plan-form').querySelector('button').disabled = true
  } else {
    q('#plan-form').querySelector('button').disabled = false
  }
}

async function transition(record) {
  if (busy) return
  busy = true
  try {
    const view = await request('replay', record)
    if (view.rejected) throw new Error(`第 ${view.rejected.index + 1} 条指令：${view.rejected.message}`)
    display(view, record)
  } catch (error) { message(error.message) }
  finally { busy = false }
}

function pickDestination(list) {
  if (!list.length) return null
  const buffer = new Uint32Array(1)
  crypto.getRandomValues(buffer)
  return list[buffer[0] % list.length]
}

function drillOption(id, label) {
  const option = document.createElement('option')
  option.value = id
  option.textContent = label
  return option
}

let planAbort = null
function clearPlan() {
  planAbort?.abort()
  q('#plan').hidden = true
  q('#plan').replaceChildren()
}

q('#reset').onclick = () => transition({ ...voyage, actions: [] })
q('#export').onclick = () => download(new Blob([JSON.stringify(voyage, null, 2)], { type: 'application/json' }), 'tide-relay-voyage.json')
q('#import').onchange = async event => {
  const file = event.target.files[0]
  event.target.value = ''
  if (!file) return
  if (file.size > 16000) return message('记录文件超出大小限制。')
  try { await transition(JSON.parse(await file.text())) } catch { message('无法读取指令文件。') }
}

q('#drill-choice').onchange = () => {
  const id = q('#drill-choice').value
  clearPlan()
  if (!id) return transition({ version: 1, course: voyage.course, actions: [] })
  const exercise = exercises.find(item => item.id === id)
  const actual = pickDestination(exercise?.arrangements ?? [])
  transition({ version: 1, course: voyage.course, drill: `${id}:${actual}`, actions: [] })
}

q('#plan-form').onsubmit = async event => {
  event.preventDefault()
  if (busy) return
  const target = Number(q('#target').value)
  q('#plan').hidden = false
  q('#plan').replaceChildren(Object.assign(document.createElement('p'), { textContent: '正在计算预案…' }))
  planAbort?.abort()
  planAbort = new AbortController()
  const signal = planAbort.signal
  try {
    const result = await request('plan', { ...voyage, target }, signal)
    if (signal.aborted) return
    showPlan(q('#plan'), result, { course: result.course, state: result.state })
  } catch (error) {
    if (error.name !== 'AbortError' && !signal.aborted) {
      q('#plan').replaceChildren(Object.assign(document.createElement('p'), { textContent: error.message, className: 'warn' }))
    }
  }
}

try {
  const first = await request('briefing')
  exercises = first.drillOptions ?? []
  q('#drill-choice').replaceChildren(drillOption('', '普通夜班'),
    ...exercises.map(item => drillOption(item.id, `预报演练 · ${item.name}`)))
  const record = loadVoyage()
  display(first, { version: 1, course: first.course.id, actions: [] }, false)
  if (record) await transition(record)
} catch (error) { message(error.message) }
