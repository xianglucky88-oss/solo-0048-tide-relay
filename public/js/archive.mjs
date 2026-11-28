// 航次归档：同一存档可在多个标签页并行续航。
// 纯函数部分不依赖浏览器环境，可直接在 Node 中验证合并规则。

export const ARCHIVE_VERSION = 2
const v2Key = 'tide-relay:v2'
const legacyKey = 'tide-relay:v1'

function signatureOf(actions) {
  return JSON.stringify(actions)
}

// 较短记录是否为较长记录的完整前缀（动作序列逐指令相同）。
export function isPrefix(shorter, longer) {
  return shorter.length <= longer.length &&
    shorter.every((action, index) => signatureOf(action) === signatureOf(longer[index]))
}

// 动作序列完全相同的记录合为一份；较短记录是较长记录完整前缀时保留较长者；
// 真正分叉的记录全部保留。合并结果与输入顺序无关。参数中的每个数组是一条航迹。
export function mergeTracks(...inputTracks) {
  const unique = new Map()
  for (const actions of inputTracks) {
    unique.set(signatureOf(actions), actions)
  }
  const tracks = [...unique.values()].sort((a, b) => b.length - a.length)
  const kept = []
  for (const actions of tracks) {
    // 已保留的记录都不短于当前记录：若当前记录是其前缀则被覆盖，否则是真正分叉。
    if (!kept.some(existing => isPrefix(actions, existing))) kept.push(actions)
  }
  return kept.sort((a, b) => signatureOf(a).localeCompare(signatureOf(b)))
}

// 旧版单航次记录直接迁移为只有一条航迹的归档，玩家无须选择即可继续。
export function migrateArchive(record, courseId) {
  if (record?.version === 1 && record.course === courseId && Array.isArray(record.actions)) {
    return { version: ARCHIVE_VERSION, course: courseId, tracks: [record.actions], selected: null }
  }
  return null
}

function normalize(archive, courseId) {
  if (archive?.version !== ARCHIVE_VERSION || archive.course !== courseId) return null
  if (!Array.isArray(archive.tracks) || archive.tracks.length === 0) return null
  const tracks = mergeTracks(...archive.tracks.filter(actions => Array.isArray(actions)))
  if (tracks.length === 0) return null
  const selected = Array.isArray(archive.selected)
    ? tracks.find(actions => signatureOf(actions) === signatureOf(archive.selected)) ?? null
    : null
  return { version: ARCHIVE_VERSION, course: courseId, tracks, selected }
}

// 把一条已验证合法的航迹并入归档。
// 已裁定分叉后，只接受等于或沿选中航迹继续的记录，其余标签的分叉写入直接忽略，
// 因此刷新旧标签或重开记录都不会重提已裁定的分叉。
// 被规则拒绝的指令不会进入这里（调用方只在服务端确认合法后提交）。
export function commitTrack(archive, courseId, actions) {
  const current = normalize(archive, courseId)
  if (!current) {
    return { version: ARCHIVE_VERSION, course: courseId, tracks: [actions], selected: null }
  }
  if (current.selected) {
    if (isPrefix(current.selected, actions)) {
      const tracks = mergeTracks(...current.tracks, actions)
        .filter(candidate => isPrefix(current.selected, candidate))
      const advanced = tracks.find(candidate => signatureOf(candidate) === signatureOf(actions)) ?? actions
      return { ...current, tracks, selected: advanced }
    }
    return current
  }
  return { ...current, tracks: mergeTracks(...current.tracks, actions) }
}

// 玩家在候选航迹中作出选择：此后该航迹成为唯一续航线。
export function selectTrack(archive, courseId, actions) {
  const current = normalize(archive, courseId)
  if (!current) return null
  const chosen = current.tracks.find(track => signatureOf(track) === signatureOf(actions))
  if (!chosen) return current
  return { ...current, tracks: [chosen], selected: chosen }
}

export function emptyArchive(courseId) {
  return { version: ARCHIVE_VERSION, course: courseId, tracks: [[]], selected: [] }
}

export function archiveSignature(archive) {
  return JSON.stringify(archive)
}

// 读取浏览器归档：优先新版，缺省时迁移旧版单航次记录。
export function loadArchive(courseId, storage = localStorage) {
  try {
    const raw = storage.getItem(v2Key)
    if (raw) {
      const archive = normalize(JSON.parse(raw), courseId)
      if (archive) return archive
    }
    const legacy = storage.getItem(legacyKey)
    if (legacy) return migrateArchive(JSON.parse(legacy), courseId)
  } catch {
    return null
  }
  return null
}

export function saveArchive(archive, courseId, storage = localStorage) {
  const normalized = normalize(archive, courseId)
  if (!normalized) return false
  try {
    storage.setItem(v2Key, JSON.stringify(normalized))
    storage.removeItem(legacyKey)
    return true
  } catch {
    return false
  }
}

export function resetStorage(storage = localStorage) {
  try {
    storage.removeItem(v2Key)
    storage.removeItem(legacyKey)
    return true
  } catch {
    return false
  }
}
