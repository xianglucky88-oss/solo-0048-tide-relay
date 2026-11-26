export function drawMap(canvas, { course, state, options }) {
  const ctx = canvas.getContext('2d')
  const { width, height } = canvas
  const point = station => [station.x * width / 100, station.y * height / 100]
  const places = new Map(course.stations.map(station => [station.id, station]))
  const open = new Set(options.filter(move => move.available).map(move => move.action.lane))
  ctx.clearRect(0, 0, width, height)
  ctx.lineWidth = 1
  ctx.strokeStyle = '#315353'
  for (let y = 24; y < height; y += 30) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke()
  }
  for (const lane of course.lanes) {
    ctx.strokeStyle = open.has(lane.id) ? '#f4bb73' : '#507775'
    ctx.lineWidth = open.has(lane.id) ? 3 : 2
    ctx.setLineDash(open.has(lane.id) ? [] : [5, 6])
    ctx.beginPath(); ctx.moveTo(...point(places.get(lane.from))); ctx.lineTo(...point(places.get(lane.to))); ctx.stroke()
  }
  ctx.setLineDash([])
  ctx.font = '16px sans-serif'
  ctx.textAlign = 'center'
  for (const station of places.values()) {
    const [x, y] = point(station)
    ctx.fillStyle = station.id === state.at ? '#f4bb73' : state.lit.includes(station.id) ? '#8de1c2' : '#e8f1dc'
    ctx.beginPath(); ctx.arc(x, y, station.id === state.at ? 10 : 6, 0, 2 * Math.PI); ctx.fill()
    ctx.fillText(station.name, x, y - 17)
  }
}
