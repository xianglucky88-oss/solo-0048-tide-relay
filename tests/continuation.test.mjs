import assert from 'node:assert/strict'
import { once } from 'node:events'
import { createApp } from '../server/app.mjs'
import {
  loadArchive, saveArchive, commitTrack, selectTrack, archiveSignature
} from '../public/js/archive.mjs'

const courseId = 'outer-reach'
const go = lane => ({ kind: 'sail', lane })
const k = kind => ({ kind })

const server = createApp()
await once(server.listen(0, '127.0.0.1'), 'listening')
const { port } = server.address()

async function replay(actions) {
  const response = await fetch(`http://127.0.0.1:${port}/api/tide-relay/replay`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ version: 1, course: courseId, actions })
  })
  assert.equal(response.status, 200)
  return response.json()
}

// 模拟同源两个标签共享的 localStorage。
function memoryStorage() {
  const map = new Map()
  return {
    getItem: key => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: key => map.delete(key)
  }
}

let passed = 0
const check = async (name, fn) => { await fn(); passed += 1; console.log(`✓ ${name}`) }

const arrive = [go('west')] // 第 2 刻抵达芦脊标
const tuned = [...arrive, k('tune')] // 一页校准
const waited = [...arrive, k('wait')] // 一页等待
const waitedTwice = [...waited, k('wait')] // 等待页再等一刻
const rejectedFinish = [...arrive, k('finish')] // 芦脊标交班，应被规则拒绝

await check('服务端确认共同起点：第 2 刻抵达芦脊标', async () => {
  const view = await replay(arrive)
  assert.equal(view.rejected, null)
  assert.equal(view.state.tick, 2)
  assert.equal(view.state.at, 'reed')
})

await check('两条第 3 刻航迹分别为点亮余 6 格、未点亮余 7 格', async () => {
  const [a, b] = await Promise.all([replay(tuned), replay(waited)])
  assert.equal(a.state.tick, 3)
  assert.equal(a.state.power, 6)
  assert.deepEqual(a.state.lit, ['reed'])
  assert.equal(b.state.tick, 3)
  assert.equal(b.state.power, 7)
  assert.deepEqual(b.state.lit, [])
})

await check('芦脊标交班被规则拒绝，拒绝指令不进入归档', async () => {
  const view = await replay(rejectedFinish)
  assert.equal(view.rejected.code, 'home')
  assert.equal(view.state.tick, 2) // 停留在拒绝前状态
})

// 场景一：两标签从共同存档出发，一页校准、一页等待，确认顺序任意。
{
  const storage = memoryStorage()
  let archive = commitTrack(null, courseId, arrive)
  // 先写等待页、后写校准页（与直觉相反的确认顺序）。
  archive = commitTrack(archive, courseId, waited)
  archive = commitTrack(archive, courseId, tuned)
  saveArchive(archive, courseId, storage)

  // 两个标签都关闭后重开：必须看到两条第 3 刻候选。
  const reopened = loadArchive(courseId, storage)
  await check('关闭重开后看到两条第 3 刻候选航迹', async () => {
    assert.equal(reopened.tracks.length, 2)
    const views = await Promise.all(reopened.tracks.map(replay))
    const summary = views.map(v => ({ tick: v.state.tick, power: v.state.power, lit: v.state.lit.length }))
    assert.deepEqual(summary, [
      { tick: 3, power: 6, lit: 1 },
      { tick: 3, power: 7, lit: 0 }
    ])
    assert.ok(views.every(v => v.state.at === 'reed'))
  })

  // 玩家选择校准航迹，继续下令与下载都使用选中的航迹。
  const decided = selectTrack(reopened, courseId, tuned)
  saveArchive(decided, courseId, storage)
  await check('裁定后只保留选中航迹，继续下令沿其推进', async () => {
    const active = loadArchive(courseId, storage)
    assert.deepEqual(active.tracks, [tuned])
    assert.deepEqual(active.selected, tuned)
    const extended = [...tuned, k('wait')]
    const view = await replay(extended)
    assert.equal(view.rejected, null)
    const merged = commitTrack(active, courseId, extended)
    assert.deepEqual(merged.tracks, [extended])
  })

  // 旧标签随后才把等待页的第 3、4 刻进展写回：不能重提已裁定的分叉。
  await check('旧标签迟到的分叉写入被忽略，重开不会重提', () => {
    const active = loadArchive(courseId, storage)
    assert.deepEqual(commitTrack(active, courseId, waited), active)
    assert.deepEqual(commitTrack(active, courseId, waitedTwice), active)
    assert.equal(archiveSignature(loadArchive(courseId, storage)), archiveSignature(active))
  })
}

// 场景二：两页都等一刻，同序列合为一份；其中一页再等一刻只留第 4 刻进展。
{
  const storage = memoryStorage()
  let archive = commitTrack(null, courseId, arrive)
  archive = commitTrack(archive, courseId, waited)
  archive = commitTrack(archive, courseId, waited) // 另一页相同序列
  assert.deepEqual(archive.tracks, [waited])
  // 第 4 刻先到、第 3 刻确认随后才到（乱序）。
  archive = commitTrack(archive, courseId, waitedTwice)
  archive = commitTrack(archive, courseId, waited)
  saveArchive(archive, courseId, storage)
  await check('同序列去重，前缀被更长进展覆盖，只剩第 4 刻航迹', async () => {
    const reopened = loadArchive(courseId, storage)
    assert.deepEqual(reopened.tracks, [waitedTwice])
    const view = await replay(reopened.tracks[0])
    assert.equal(view.state.tick, 4)
    assert.equal(view.state.power, 7)
    assert.deepEqual(view.state.lit, [])
  })
}

// 场景三：一页交班被拒（不提交），另一页合法进展直接续航，无须选择分叉。
{
  const storage = memoryStorage()
  let archive = commitTrack(null, courseId, arrive)
  const denied = await replay(rejectedFinish)
  assert.ok(denied.rejected) // 被拒指令不调用 commitTrack
  archive = commitTrack(archive, courseId, tuned)
  saveArchive(archive, courseId, storage)
  await check('被拒页不产生分叉，合法页进展可直接续航', () => {
    const reopened = loadArchive(courseId, storage)
    assert.equal(reopened.tracks.length, 1)
    assert.equal(reopened.selected, null)
    assert.deepEqual(reopened.tracks[0], tuned)
  })
}

// 场景四：旧版单航次存档直接继续。
{
  const storage = memoryStorage()
  storage.setItem('tide-relay:v1', JSON.stringify({ version: 1, course: courseId, actions: arrive }))
  const migrated = loadArchive(courseId, storage)
  await check('旧版单航次存档迁移后可直接继续', () => {
    assert.equal(migrated.tracks.length, 1)
    assert.deepEqual(migrated.tracks[0], arrive)
    assert.equal(migrated.selected, null)
  })
}

server.close()
console.log(`\n全部 ${passed} 项端到端续航检查通过。`)
