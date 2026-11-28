export class InputError extends Error {
  constructor(message, status = 400, extra = {}) {
    super(message)
    this.status = status
    this.code = extra.code ?? null
    this.issues = extra.issues ?? null
  }
}
