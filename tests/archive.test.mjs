import assert from 'node:assert/strict'
import {
  mergeTracks, commitTrack, selectTrack, migrateArchive,
  emptyArchive, loadArchive, saveArchive, resetStorage, ARCHIVE_VERSION
} from '../public/js/archive.mjs'

const go = lane => ({ kind: 'sail', lane })
const k = kind => ({ kind })
const courseId = 'outer-reach'

// 内存版 Storage，模拟同源多标签共享的 localStorage。
function memoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial))
  return {
    getItem: key => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: key => map.delete(key)
  }
}

// 共同起点：第 2 刻抵达芦脊标。
const arrive = [go('west')]
const tuned = [...arrive, k('tune')] // 第 3 刻：点亮，余 6 格
const waited = [...arrive, k('wait')] // 第 3 刻：未点亮，余 7 格
const waitedTwice = [...waited, k('wait')] // 第 4 刻：未点亮，余 7 格

let passed = 0
function check(name, fn) {
  fn()
  passed += 1
  console.log(`✓ ${name}`)
}

check('动作序列相同的记录合为一份', () => {
  assert.deepEqual(mergeTracks(tuned, tuned), [tuned])
})

check('较短记录是较长记录完整前缀时保留较长者', () => {
  assert.deepEqual(mergeTracks(arrive, tuned), [tuned])
  assert.deepEqual(mergeTracks(tuned, arrive), [tuned])
})

check('真正分叉时保留双方航迹', () => {
  assert.deepEqual(mergeTracks(tuned, waited), [tuned, waited])
})

check('合并结果与确认顺序无关（乱序到达同样收敛）', () => {
  const one = mergeTracks(arrive, tuned, waited)
  const other = mergeTracks(waited, arrive, tuned)
  assert.deepEqual(one, [tuned, waited])
  assert.deepEqual(other, [tuned, waited])
})

check('两页都只等一刻：同序列去重，只剩一条第 3 刻航迹', () => {
  assert.deepEqual(mergeTracks(waited, waited), [waited])
})

check('一页再等一刻：第 4 刻进展覆盖第 3 刻前缀，即使第 3 刻确认随后才到', () => {
  const later = mergeTracks(waitedTwice, waited)
  assert.deepEqual(later, [waitedTwice])
  const reversed = mergeTracks(waited, waitedTwice)
  assert.deepEqual(reversed, [waitedTwice])
})

check('分叉与前缀混合提交后仍是两条候选，且都从共同起点长出', () => {
  let archive = null
  archive = commitTrack(archive, courseId, arrive)
  archive = commitTrack(archive, courseId, tuned)
  archive = commitTrack(archive, courseId, waited)
  assert.equal(archive.tracks.length, 2)
  assert.deepEqual(archive.tracks, [tuned, waited])
  assert.equal(archive.selected, null)
})

check('被规则拒绝的指令不参与续航：只提交合法页的进展，无须选择分叉', () => {
  // 一页在芦脊标尝试交班被拒（rejected 不进入 commitTrack），另一页合法等待。
  let archive = commitTrack(null, courseId, arrive)
  archive = commitTrack(archive, courseId, waited)
  assert.equal(archive.tracks.length, 1)
  assert.deepEqual(archive.tracks, [waited])
  assert.equal(archive.selected, null)
})

check('裁定分叉后，旧标签的另一分叉写入被忽略，不会重提分叉', () => {
  let archive = commitTrack(null, courseId, tuned)
  archive = commitTrack(archive, courseId, waited)
  const decided = selectTrack(archive, courseId, tuned)
  assert.deepEqual(decided.tracks, [tuned])
  // 旧标签随后才把自己的第 3 刻、第 4 刻进展写回。
  const staleWrite = commitTrack(decided, courseId, waited)
  assert.deepEqual(staleWrite, decided)
  const staleLonger = commitTrack(decided, courseId, waitedTwice)
  assert.deepEqual(staleLonger, decided)
})

check('选中航迹的继续下令沿同一续航线推进，前缀自动收敛', () => {
  let archive = selectTrack(
    commitTrack(commitTrack(null, courseId, tuned), courseId, waited), courseId, tuned)
  const extended = [...tuned, k('charge')]
  archive = commitTrack(archive, courseId, extended)
  assert.deepEqual(archive.tracks, [extended])
  assert.deepEqual(archive.selected, extended)
  // 刷新后旧的较短选中记录再次写入也不会回退。
  const refresh = commitTrack(archive, courseId, tuned)
  assert.deepEqual(refresh.selected, extended)
})

check('旧版单航次存档可直接继续，无须选择', () => {
  const legacy = { version: 1, course: courseId, actions: tuned }
  const migrated = migrateArchive(legacy, courseId)
  assert.equal(migrated.version, ARCHIVE_VERSION)
  assert.deepEqual(migrated.tracks, [tuned])
  assert.equal(migrated.selected, null)
  const continued = commitTrack(migrated, courseId, [...tuned, k('wait')])
  assert.equal(continued.tracks.length, 1)
})

check('localStorage 适配层：迁移、持久化、重开读取一致', () => {
  const storage = memoryStorage()
  storage.setItem('tide-relay:v1', JSON.stringify({ version: 1, course: courseId, actions: arrive }))
  const loaded = loadArchive(courseId, storage)
  assert.deepEqual(loaded.tracks, [arrive])
  const withFork = commitTrack(commitTrack(loaded, courseId, tuned), courseId, waited)
  assert.equal(saveArchive(withFork, courseId, storage), true)
  assert.equal(storage.getItem('tide-relay:v1'), null)
  const reopened = loadArchive(courseId, storage)
  assert.deepEqual(reopened.tracks, [tuned, waited])
  // 重开后选定其中一条。
  const decided = selectTrack(reopened, courseId, waited)
  saveArchive(decided, courseId, storage)
  assert.deepEqual(loadArchive(courseId, storage).tracks, [waited])
  resetStorage(storage)
  assert.equal(loadArchive(courseId, storage), null)
})

check('重新出航会建立空航迹并立即裁定，后续分叉写入被忽略', () => {
  const fresh = emptyArchive(courseId)
  const storage = memoryStorage()
  saveArchive(fresh, courseId, storage)
  let archive = loadArchive(courseId, storage)
  archive = commitTrack(archive, courseId, waited)
  assert.deepEqual(archive.tracks, [waited])
  assert.deepEqual(archive.selected, waited)
})

check('其他航图或损坏的归档不会被误读', () => {
  const storage = memoryStorage()
  storage.setItem('tide-relay:v2', JSON.stringify({ version: ARCHIVE_VERSION, course: 'other', tracks: [[]] }))
  assert.equal(loadArchive(courseId, storage), null)
  storage.setItem('tide-relay:v2', '{不是合法 JSON')
  assert.equal(loadArchive(courseId, storage), null)
})

console.log(`\n全部 ${passed} 项归档规则检查通过。`)
