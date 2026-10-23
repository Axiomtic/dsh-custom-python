/**
 * Session-scoped explicit choices (precedence layer L1).
 *
 * A choice made through the UI may not carry the exact Session id the tool sees, so the
 * literal key is consulted first and the UI's `process` key second. The tool's own `use`
 * action always writes the literal id.
 */

/**
 * @param {Map<string, string>} sessions
 * @param {string} sessionId
 * @returns {{interpreter: string}|undefined}
 */
export function sessionChoice(sessions, sessionId) {
  const value = sessions.get(sessionId) ?? sessions.get('process')
  return value ? { interpreter: value } : undefined
}
