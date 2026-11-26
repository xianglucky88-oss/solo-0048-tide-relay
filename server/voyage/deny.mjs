export class RuleViolation extends Error {
  constructor(code, message) {
    super(message)
    this.code = code
  }
}

export function requireRule(predicate, code, message) {
  if (!predicate) throw new RuleViolation(code, message)
}
