export function showCalendar(container, slots) {
  container.replaceChildren(...slots.map(({ tick, label }, index) => {
    const entry = document.createElement('li')
    entry.textContent = `${tick} 刻 ${label}`
    if (index === 0) entry.setAttribute('aria-current', 'time')
    return entry
  }))
}
