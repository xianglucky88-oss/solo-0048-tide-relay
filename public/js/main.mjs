import { request } from './request.mjs'
import { download } from './download.mjs'
import { loadVoyage, saveVoyage } from './harbor-store.mjs'
import { drawMap } from './map.mjs'
import { drawOrders } from './order-board.mjs'
import { showCalendar } from './calendar.mjs'
import { showLog } from './log.mjs'
import { showStatus } from './status.mjs'

const q = selector => document.querySelector(selector)
let voyage, busy = false
const message = text => { q('#message').textContent = text }

function display(view, record, persist = true) {
  voyage = record
  showStatus(view)
  drawMap(q('#chart'), view)
  drawOrders(q('#orders'), view, action => transition({ ...voyage, actions: [...voyage.actions, action] }))
  showCalendar(q('#calendar'), view.calendar)
  showLog(q('#log'), view)
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

q('#reset').onclick = () => transition({ ...voyage, actions: [] })
q('#export').onclick = () => download(new Blob([JSON.stringify(voyage, null, 2)], { type: 'application/json' }), 'tide-relay-voyage.json')
q('#import').onchange = async event => {
  const file = event.target.files[0]
  event.target.value = ''
  if (!file) return
  if (file.size > 16000) return message('记录文件超出大小限制。')
  try { await transition(JSON.parse(await file.text())) } catch { message('无法读取指令文件。') }
}

try {
  const first = await request('briefing')
  const record = loadVoyage()
  display(first, { version: 1, course: first.course.id, actions: [] }, false)
  if (record) await transition(record)
} catch (error) { message(error.message) }
