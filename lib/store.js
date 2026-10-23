/**
 * Plugin-owned settings store.
 *
 * One flat record, written only by the settings page:
 * `{ enabled, defaultInterpreter }`. `enabled: false` is the "关闭自定义 Python" state —
 * the plugin then behaves as if it were not installed.
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
 * @returns {{enabled?: boolean, defaultInterpreter?: string}}
 */
export function readSettings(env) {
  const file = join(storeDir(env), 'settings.json')
  if (!existsSync(file)) return {}
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8'))
    if (!parsed || typeof parsed !== 'object') return {}
    const settings = {}
    if (typeof parsed.enabled === 'boolean') settings.enabled = parsed.enabled
    if (typeof parsed.defaultInterpreter === 'string' && parsed.defaultInterpreter.length > 0) {
      settings.defaultInterpreter = parsed.defaultInterpreter
    }
    return settings
  } catch {
    return {}
  }
}

/**
 * Merge a patch into the stored record. `undefined` leaves a field untouched, `null` removes it.
 * @param {{enabled?: boolean, defaultInterpreter?: string|null}} patch
 * @param {Record<string, string|undefined>} [env]
 */
export function writeSettings(patch, env) {
  const dir = storeDir(env)
  mkdirSync(dir, { recursive: true })
  const next = { ...readSettings(env) }
  if (patch.enabled !== undefined) next.enabled = patch.enabled
  if (patch.defaultInterpreter === null) delete next.defaultInterpreter
  else if (typeof patch.defaultInterpreter === 'string') next.defaultInterpreter = patch.defaultInterpreter
  writeFileSync(join(dir, 'settings.json'), `${JSON.stringify(next, null, 2)}\n`, 'utf8')
  return next
}

/**
 * Whether the first-run prompt has already been answered.
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
