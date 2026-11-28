// 预报演练的两种航道开放安排。安排自 announce 刻起生效，此前一律沿用原潮窗。
export const exercises = {
  'ridge-return': {
    id: 'ridge-return',
    name: '石脊返航演练',
    announce: 8,
    arrangements: [
      {
        id: 'a',
        code: '甲',
        name: '甲案 · 石脊直航',
        detail: '自第 8 刻起，仅第 8、9 刻开放石脊至西塘的航道；横向航道关闭至交班。',
        from: 8,
        lanes: { creek: { open: [8, 9] }, crossing: { closed: true } }
      },
      {
        id: 'b',
        code: '乙',
        name: '乙案 · 芦脊绕航',
        detail: '自第 8 刻起，石脊至西塘的航道关闭至交班；横向航道沿用原潮窗。',
        from: 8,
        lanes: { creek: { closed: true } }
      }
    ]
  }
}

export function exerciseById(id) {
  return exercises[id] ?? null
}

// 实录中的演练标识形如 "ridge-return:a"，同时锁定场景与当班实况。
export function parseDrill(token) {
  if (typeof token !== 'string') return null
  const [id, actual, ...rest] = token.split(':')
  if (rest.length) return null
  const ex = exerciseById(id)
  if (!ex) return null
  if (actual !== undefined && !ex.arrangements.some(item => item.id === actual)) return null
  return { ex, actual: actual ?? ex.arrangements[0].id }
}

export function drillToken(drill) {
  return drill ? `${drill.ex.id}:${drill.actual}` : null
}

export function drillOptions() {
  return Object.values(exercises).map(ex => ({
    id: ex.id, name: ex.name, announce: ex.announce,
    arrangements: ex.arrangements.map(item => item.id)
  }))
}
