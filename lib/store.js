/**
 * Plugin-owned settings store.
 *
 * The global default lives in a small JSON file under the DSH home rather than in the Loader
 * row: the row is hand-edited YAML and the settings page needs to write, and reusing the
 * `configEditor` service would couple this plugin to an untyped internal API. Precedence is
 * therefore file > row `config.defaultInterpreter`.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

/**
 * @param {Record<string, string|undefined>} [env]
 * @returns {string} Directory this plugin owns under the DSH home.
 */
export function storeDir(env = process.env) {
  const home = env.DSH_HOME ?? join(homedir(), '.dsh')
  return join(home, 'custom-python')
}

/**
 * @param {Record<string, string|undefined>} [env]
 * @returns {{defaultInterpreter?: string}} Persisted settings, or an empty object.
 */
export function readSettings(env) {
  const file = join(storeDir(env), 'settings.json')
  if (!existsSync(file)) return {}
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8'))
    if (parsed && typeof parsed === 'object' && typeof parsed.defaultInterpreter === 'string') {
      return { defaultInterpreter: parsed.defaultInterpreter }
    }
    return {}
  } catch {
    return {}
  }
}

/**
 * @param {{defaultInterpreter?: string|null}} patch
 * @param {Record<string, string|undefined>} [env]
 */
export function writeSettings(patch, env) {
  const dir = storeDir(env)
  mkdirSync(dir, { recursive: true })
  const current = readSettings(env)
  const next = { ...current }
  if (patch.defaultInterpreter === null) delete next.defaultInterpreter
  else if (typeof patch.defaultInterpreter === 'string') next.defaultInterpreter = patch.defaultInterpreter
  writeFileSync(join(dir, 'settings.json'), `${JSON.stringify(next, null, 2)}\n`, 'utf8')
  return next
}

/**
 * Whether the first-run prompt has already been answered (chosen or skipped).
 * @param {Record<string, string|undefined>} [env]
 */
export function isOnboarded(env) {
  return existsSync(join(storeDir(env), 'onboarded'))
}

/**
 * @param {Record<string, string|undefined>} [env]
 */
export function markOnboarded(env) {
  mkdirSync(storeDir(env), { recursive: true })
  writeFileSync(join(storeDir(env), 'onboarded'), `${new Date().toISOString()}\n`, 'utf8')
}
