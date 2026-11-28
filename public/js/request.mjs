export async function request(operation, body, signal) {
  const options = body === undefined ? { signal } : {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal
  }
  const response = await fetch(`/api/tide-relay/${operation}`, options)
  if (!response.ok) {
    const payload = await response.json()
    throw new Error(payload.error)
  }
  return response.headers.get('content-type').startsWith('application/json')
    ? response.json() : response.blob()
}
