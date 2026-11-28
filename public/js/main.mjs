import { request } from './request.mjs'
import { download } from './download.mjs'
import {
  loadArchive, saveArchive, commitTrack, selectTrack,
  emptyArchive, archiveSignature
} from './archive.mjs'
import { drawMap } from './map.mjs'
import { drawOrders } from './order-board.mjs'
import { drawForks } from './fork-panel.mjs'
import { showCalendar } from './calendar.mjs'
import { showLog } from './log.mjs'
import { showStatus } from './status.mjs'

const q = selector => document.querySelector(selector)
let courseId, archive, view, busy = false
let lastSignature = null
const message = text => { q('#message').textContent = text }

function recordFor(actions) {
  return { version: 1, course: courseId, actions }
}

function render(record) {
  showStatus(view)
  drawMap(q('#chart'), view)
  drawOrders(q('#orders'), view, action => transition([...record.actions, action]))
  showCalendar(q('#calendar'), view.calendar)
  showLog(q('#log'), view)
}

// 按当前归档切换页面：单条航迹直接展示；多条候选要求玩家先裁定。
async function adoptArchive(next, notice = '') {
  archive = next
  const forked = archive.tracks.length > 1 && archive.selected === null
  if (forked) {
    const views = await Promise.all(archive.tracks.map(actions => request('replay', recordFor(actions))))
    q('#fork-panel').hidden = false
    drawForks(q('#forks'), views, index => chooseTrack(index))
    view = views[0]
    render(recordFor(archive.tracks[0]))
    message('存在多条候选航迹，请先选择续航航迹。')
    q('#export').disabled = true
    return
  }
  q('#fork-panel').hidden = true
  const actions = archive.selected ?? archive.tracks[0]
  view = await request('replay', recordFor(actions))
  render(recordFor(actions))
  message(notice)
  q('#export').disabled = false
}

// 玩家从候选中选定一条航迹：写入裁定，其他标签经 storage 事件同步后不会重提。
async function chooseTrack(index) {
  if (busy) return
  busy = true
  try {
    const decided = selectTrack(archive, courseId, archive.tracks[index])
    if (!saveArchive(decided, courseId)) return message('浏览器无法保留航次，仍可下载指令记录。')
    lastSignature = archiveSignature(decided)
    await adoptArchive(decided, '已沿选中的航迹继续续航。')
  } finally { busy = false }
}

// 已验证合法的航迹提交给归档；被规则拒绝的指令不会进入这里。
async function commit(actions, notice = '') {
  const merged = commitTrack(archive, courseId, actions)
  if (!saveArchive(merged, courseId)) {
    message('浏览器无法保留航次，仍可下载指令记录。')
    return
  }
  lastSignature = archiveSignature(merged)
  await adoptArchive(merged, notice)
}

async function transition(actions) {
  if (busy) return
  busy = true
  try {
    const nextView = await request('replay', recordFor(actions))
    if (nextView.rejected) throw new Error(`第 ${nextView.rejected.index + 1} 条指令：${nextView.rejected.message}`)
    await commit(actions)
  } catch (error) { message(error.message) }
  finally { busy = false }
}

// 另一标签写入归档后（即使在保存提示或冲突后立即关闭），本标签即时合并重算。
window.addEventListener('storage', async event => {
  if (!event.key?.startsWith('tide-relay:') || busy) return
  const latest = loadArchive(courseId)
  if (!latest || archiveSignature(latest) === lastSignature) return
  lastSignature = archiveSignature(latest)
  await adoptArchive(latest, '航次记录已与其他标签页同步。')
})

q('#reset').onclick = async () => {
  if (busy) return
  busy = true
  try {
    const fresh = emptyArchive(courseId)
    if (!saveArchive(fresh, courseId)) return message('浏览器无法保留航次，仍可下载指令记录。')
    lastSignature = archiveSignature(fresh)
    await adoptArchive(fresh, '已重新出航。')
  } finally { busy = false }
}

q('#export').onclick = () => {
  const actions = archive.selected ?? archive.tracks[0]
  download(new Blob([JSON.stringify(recordFor(actions), null, 2)], { type: 'application/json' }),
    'tide-relay-voyage.json')
}

q('#import').onchange = async event => {
  const file = event.target.files[0]
  event.target.value = ''
  if (!file) return
  if (file.size > 16000) return message('记录文件超出大小限制。')
  if (busy) return
  busy = true
  try {
    const record = JSON.parse(await file.text())
    const imported = await request('replay', record)
    if (imported.rejected) throw new Error(`第 ${imported.rejected.index + 1} 条指令：${imported.rejected.message}`)
    await commit(record.actions, '指令记录已载入并并入当前存档。')
  } catch (error) {
    message(error.message || '无法读取指令文件。')
  } finally { busy = false }
}

try {
  const first = await request('briefing')
  courseId = first.course.id
  const stored = loadArchive(courseId)
  if (stored) {
    archive = stored
    lastSignature = archiveSignature(stored)
    await adoptArchive(stored)
  } else {
    archive = emptyArchive(courseId)
    saveArchive(archive, courseId)
    lastSignature = archiveSignature(archive)
    view = first
    render(recordFor([]))
    q('#export').disabled = false
  }
  q('#reset').disabled = false
  q('#import').disabled = false
} catch (error) { message(error.message) }
