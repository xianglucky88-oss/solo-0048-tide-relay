import { request } from './request.mjs'
import { download } from './download.mjs'
import { loadVoyage, saveVoyage } from './harbor-store.mjs'
import { drawMap } from './map.mjs'
import { drawOrders } from './order-board.mjs'
import { showCalendar } from './calendar.mjs'
import { showLog } from './log.mjs'
import { showStatus } from './status.mjs'

const q = selector => document.querySelector(selector)
const courses = [
  { id: 'outer-reach', name: '外湾夜班（18 刻）' },
  { id: 'outer-reach-special', name: '外湾专项班（27 刻 · 收发联调）' }
]
let courseId = courses[0].id
let voyage, busy = false
const message = text => { q('#message').textContent = text }

function display(view, record, persist = true) {
  voyage = record
  showStatus(view)
  drawMap(q('#chart'), view)
  drawOrders(q('#orders'), view, action => transition({ ...voyage, actions: [...voyage.actions, action] }))
  showCalendar(q('#calendar'), view.calendar)
  showLog(q('#log'), view)
  q('#plate-title').textContent = view.course.name
  q('#chart-caption').textContent = view.course.mode === 'relay'
    ? '亮线表示当前可走航路，绿线为交班计分链路；标旁 发/收 为已采用的收发设置。'
    : '亮线表示当前可走航路，虚线表示其余航路。'
  message(!persist || saveVoyage(record) ? '' : '浏览器无法保留航次，仍可下载指令记录。')
  q('#reset').disabled = false
  q('#export').disabled = false
  q('#import').disabled = false
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

async function openCourse(id, restore = true) {
  courseId = id
  const first = await request(`briefing?course=${encodeURIComponent(id)}`)
  display(first, { version: 1, course: id, actions: [] }, false)
  if (restore) {
    const record = loadVoyage(id)
    if (record) await transition(record)
  }
}

q('#course-select').replaceChildren(...courses.map(course => {
  const option = document.createElement('option')
  option.value = course.id
  option.textContent = course.name
  return option
}))
q('#course-select').value = courseId
q('#course-select').onchange = event => openCourse(event.target.value)

q('#reset').onclick = () => transition({ ...voyage, actions: [] })
q('#export').onclick = () => download(new Blob([JSON.stringify(voyage, null, 2)], { type: 'application/json' }), 'tide-relay-voyage.json')
q('#import').onchange = async event => {
  const file = event.target.files[0]
  event.target.value = ''
  if (!file) return
  if (file.size > 16000) return message('记录文件超出大小限制。')
  try {
    const record = JSON.parse(await file.text())
    if (record.course && record.course !== courseId) await openCourse(record.course, false)
    await transition(record)
  } catch { message('无法读取指令文件。') }
}

try {
  await openCourse(courseId)
} catch (error) { message(error.message) }
