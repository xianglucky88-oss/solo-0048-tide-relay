const bandLabel = { send: '发', receive: '收' }
const linkColor = '#a9e9c9'

export function drawMap(canvas, { course, state, options, score }) {
  const ctx = canvas.getContext('2d')
  const { width, height } = canvas
  const point = station => [station.x * width / 100, station.y * height / 100]
  const places = new Map(course.stations.map(station => [station.id, station]))
  const open = new Set(options.filter(move => move.available).map(move => move.action.lane))
  const scored = new Set((score.links ?? []).map(link => link.lane))
  ctx.clearRect(0, 0, width, height)
  ctx.lineWidth = 1
  ctx.strokeStyle = '#315353'
  for (let y = 24; y < height; y += 30) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke()
  }
  for (const lane of course.lanes) {
    const isScored = scored.has(lane.id)
    ctx.strokeStyle = isScored ? linkColor : open.has(lane.id) ? '#f4bb73' : '#507775'
    ctx.lineWidth = isScored ? 4 : open.has(lane.id) ? 3 : 2
    ctx.setLineDash(isScored ? [] : open.has(lane.id) ? [] : [5, 6])
    ctx.beginPath()
    ctx.moveTo(...point(places.get(lane.from)))
    ctx.lineTo(...point(places.get(lane.to)))
    ctx.stroke()
    if (isScored) {
      const [ax, ay] = point(places.get(lane.from))
      const [bx, by] = point(places.get(lane.to))
      const link = score.links.find(item => item.lane === lane.id)
      ctx.fillStyle = linkColor
      ctx.font = 'bold 13px sans-serif'
      ctx.fillText(`${link.points} 点`, (ax + bx) / 2, (ay + by) / 2 - 6)
    }
  }
  ctx.setLineDash([])
  ctx.font = '16px sans-serif'
  ctx.textAlign = 'center'
  for (const station of places.values()) {
    const [x, y] = point(station)
    const band = state.signals?.[station.id]
    const lit = state.lit.includes(station.id)
    ctx.fillStyle = station.id === state.at ? '#f4bb73' : lit || band ? '#8de1c2' : '#e8f1dc'
    ctx.beginPath(); ctx.arc(x, y, station.id === state.at ? 10 : 6, 0, 2 * Math.PI); ctx.fill()
    ctx.fillText(station.name, x, y - 17)
    if (band) {
      ctx.fillStyle = band === 'send' ? '#ffca94' : '#9fd6ff'
      ctx.font = 'bold 13px sans-serif'
      ctx.fillText(bandLabel[band], x + 14, y + 5)
      ctx.font = '16px sans-serif'
    }
  }
}
