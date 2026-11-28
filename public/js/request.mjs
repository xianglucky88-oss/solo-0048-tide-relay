export async function request(operation, body) {
  const options = body === undefined ? {} : {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body)
  }
  const response = await fetch(`/api/tide-relay/${operation}`, options)
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}))
    const error = new Error(payload.error || '请求失败，请重试。')
    error.code = payload.code ?? null
    error.issues = payload.issues ?? null
    throw error
  }
  return response.headers.get('content-type').startsWith('application/json')
    ? response.json() : response.blob()
}
