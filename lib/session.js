/**
 * Explicit interpreter choices (precedence layer L1).
 *
 * Order of authority: a per-session `use`, then the global default picked in settings, then
 * nothing — at which point the layer chain decides. The UI writes the global default, so a
 * choice made there must beat a workspace file; that is why it is fed in as a session-level
 * choice rather than as another chain layer.
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

/**
 * The explicit choice for this call: session first, then the global default.
 *
 * A default that points at the bundled runtime is not an explicit choice — it means "use the
 * bundled one", which the chain already answers at L7, and which must never shadow PATH.
 * @param {Map<string, string>} sessions
 * @param {string} sessionId
 * @param {{enabled?: boolean, defaultInterpreter?: string}} settings
 * @param {string|null} [bundledPath]
 * @returns {{interpreter: string}|undefined}
 */
export function effectiveChoice(sessions, sessionId, settings, bundledPath) {
  const session = sessionChoice(sessions, sessionId)
  if (session) return session
  if (settings.enabled === false) return undefined
  const chosen = settings.defaultInterpreter
  if (!chosen) return undefined
  if (bundledPath && chosen === bundledPath) return undefined
  return { interpreter: chosen }
}
