/**
 * Plugin configuration: defaults, normalisation, and fail-fast validation.
 *
 * Every field is optional so the bundle activates with an empty `config` block.
 * Validation errors are prefixed with `custom-python:` so a failed activation is
 * attributable in the Loader log.
 */

/** @typedef {object} Settings */
/** @typedef {{ error: string }} ConfigIssue */

const DEFAULTS = {
  defaultInterpreter: undefined,
  workspaceFile: true,
  pythonVersionFile: true,
  venv: true,
  autoInstall: false,
  bundledInterpreter: undefined,
  probeTimeoutMs: 5000,
  cacheTtlMs: 30_000,
  installTimeoutMs: 60_000,
  runTimeoutMs: 120_000,
}

function issue(field, expected, value) {
  const rendered = value === undefined ? 'undefined' : JSON.stringify(value)
  return new Error(`custom-python: config.${field} must be ${expected}, got ${rendered}`)
}

function optionalAbsolutePath(field, value) {
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'string' || value.length === 0) throw issue(field, 'a non-empty absolute path', value)
  if (!/^[A-Za-z]:[\\/]|^\//u.test(value)) throw issue(field, 'an absolute path', value)
  return value
}

function optionalBoolean(field, value, fallback) {
  if (value === undefined || value === null) return fallback
  if (typeof value !== 'boolean') throw issue(field, 'a boolean', value)
  return value
}

function optionalDuration(field, value, fallback) {
  if (value === undefined || value === null) return fallback
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw issue(field, 'a positive number of milliseconds', value)
  }
  return value
}

/**
 * Normalise a raw Loader `config` object into the settings the resolver consumes.
 * @param {unknown} raw - The row's `config` value; `undefined` or `{}` activates with defaults.
 * @returns {Settings}
 */
export function normalizeConfig(raw) {
  if (raw === undefined || raw === null) return { ...DEFAULTS }
  if (typeof raw !== 'object' || Array.isArray(raw)) throw issue('<root>', 'an object', raw)
  /** @type {Record<string, unknown>} */
  const input = /** @type {any} */ (raw)
  return {
    defaultInterpreter: optionalAbsolutePath('defaultInterpreter', input.defaultInterpreter),
    workspaceFile: optionalBoolean('workspaceFile', input.workspaceFile, DEFAULTS.workspaceFile),
    pythonVersionFile: optionalBoolean('pythonVersionFile', input.pythonVersionFile, DEFAULTS.pythonVersionFile),
    venv: optionalBoolean('venv', input.venv, DEFAULTS.venv),
    autoInstall: optionalBoolean('autoInstall', input.autoInstall, DEFAULTS.autoInstall),
    bundledInterpreter: optionalAbsolutePath('bundledInterpreter', input.bundledInterpreter),
    probeTimeoutMs: optionalDuration('probeTimeoutMs', input.probeTimeoutMs, DEFAULTS.probeTimeoutMs),
    cacheTtlMs: optionalDuration('cacheTtlMs', input.cacheTtlMs, DEFAULTS.cacheTtlMs),
    installTimeoutMs: optionalDuration('installTimeoutMs', input.installTimeoutMs, DEFAULTS.installTimeoutMs),
    runTimeoutMs: optionalDuration('runTimeoutMs', input.runTimeoutMs, DEFAULTS.runTimeoutMs),
  }
}

export { DEFAULTS }
