import { request } from './request.mjs'
import { download } from './download.mjs'
import { loadVoyage, saveVoyage, loadChart, saveChart } from './harbor-store.mjs'
import { drawMap } from './map.mjs'
import { drawOrders } from './order-board.mjs'
import { showCalendar } from './calendar.mjs'
import { showLog } from './log.mjs'
import { showStatus } from './status.mjs'

const q = selector => document.querySelector(selector)
let voyage, busy = false
const message = text => { q('#message').textContent = text }

// 记录当前开赛航图：自制航图为已规范化的 course 对象，内置夜班为 null。
let activeChart = null

function display(view, record, persist = true) {
  voyage = record
  showStatus(view)
  drawMap(q('#chart'), view)
  drawOrders(q('#orders'), view, action => transition({ ...voyage, actions: [...voyage.actions, action] }))
  showCalendar(q('#calendar'), view.calendar)
  showLog(q('#log'), view)
  q('#plate-title').textContent = view.course.name
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

// v2 自包含实录：内嵌开赛航图，陌生浏览器或同名同标识的新航图环境都能按原航图重放/续玩。
function recordFor(course, chart, actions) {
  return chart
    ? { version: 2, course: course.id, chart, actions }
    : { version: 1, course: course.id, actions }
}

q('#reset').onclick = () => transition(recordFor(voyageCourse(), activeChart, []))
q('#export').onclick = () =>
  download(new Blob([JSON.stringify(voyage, null, 2)], { type: 'application/json' }),
    `tide-relay-${voyage.course}.json`)

q('#import').onchange = async event => {
  const file = event.target.files[0]
  event.target.value = ''
  if (!file) return
  if (file.size > 65536) return message('记录文件超出大小限制。')
  try {
    const record = JSON.parse(await file.text())
    const view = await request('replay', record)
    if (view.rejected) throw new Error(`第 ${view.rejected.index + 1} 条指令：${view.rejected.message}`)
    // 自包含实录切换到它内嵌的开赛航图，旧图实录仍按旧图复盘。
    activeChart = record.version === 2 ? view.course : null
    if (activeChart && !saveChart(activeChart)) message('浏览器无法保留航图，本次复盘仍可继续。')
    display(view, record)
  } catch (error) {
    message(error.code === 'invalid-chart' ? `实录内嵌航图无效，已保留当前航次：${error.message}` :
      `无法载入指令文件：${error.message}`)
  }
}

q('#import-chart').onchange = async event => {
  const file = event.target.files[0]
  event.target.value = ''
  if (!file) return
  if (file.size > 65536) return message('航图文件超出大小限制。')
  let chart
  try { chart = JSON.parse(await file.text()) }
  catch { return message('无法读取航图文件，请提供 JSON 航图。') }
  try {
    const view = await request('chart', chart)
    activeChart = view.course
    saveChart(activeChart)
    // 导入成功才切换航次；被拒收时当前航次与续航记录原样保留。
    display(view, recordFor(view.course, activeChart, []))
    message(`已导入航图「${view.course.name}」，最短获胜航迹需 ${view.winningActions} 条指令。`)
  } catch (error) {
    if (error.code === 'invalid-chart') {
      message(`航图配置无效，已拒收并保留当前航次：${error.message}`)
    } else if (error.code === 'unsolvable') {
      message(`无获胜航迹，已拒收并保留当前航次：${error.message}`)
    } else {
      message(error.message)
    }
  }
}

function voyageCourse() {
  return activeChart ?? { id: voyage.course }
}

try {
  const first = await request('briefing')
  const savedChart = loadChart()
  const savedVoyage = loadVoyage()
  if (savedChart) {
    // 刷新或另开同名同标识航图后重新导入，都从保存的开赛航图继续。
    activeChart = savedChart
    const view = await request('replay', recordFor(savedChart, savedChart, []))
    display(view, recordFor(savedChart, savedChart, []), false)
  } else {
    display(first, { version: 1, course: first.course.id, actions: [] }, false)
  }
  if (savedVoyage) {
    // v2 实录自带开赛航图；v1 实录沿用当前航图（内置夜班或已保存的自制航图）。
    const useChart = savedVoyage.version === 2 ? savedVoyage.chart : activeChart
    if (useChart) {
      activeChart = useChart
      saveChart(useChart)
    }
    const course = useChart ?? first.course
    await transition(recordFor(course, useChart, savedVoyage.actions))
  }
} catch (error) { message(error.message) }
