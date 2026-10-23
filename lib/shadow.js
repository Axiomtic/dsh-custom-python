/**
 * Name shadowing: make the bare names `python` and `python3` resolve to the chosen interpreter.
 *
 * The spike behind ticket 06 found no supported hook for per-spawn shell environment: the
 * executors inherit `process.env.PATH` verbatim and re-read it on every spawn, while the
 * shell service cannot be wrapped (`service "shell" has been registered`). So the shadow is a
 * process-level PATH prefix, rebuilt from a snapshot each time, and restored on dispose.
 *
 * Consequences, accepted deliberately:
 * - it follows the most recently resolved interpreter, not a per-session one;
 * - it only affects *name* resolution — absolute paths keep their original target;
 * - it is skipped when the winner is the bundled runtime, so Office tooling is untouched.
 */

import { delimiter, dirname } from 'node:path'

/**
 * @param {object} options
 * @param {Record<string, string|undefined>} [options.env] - Process environment to mutate.
 */
export function createShadow({ env = process.env } = {}) {
  const original = env.PATH ?? env.Path ?? ''
  const key = env.PATH === undefined && env.Path !== undefined ? 'Path' : 'PATH'
  let active = null

  return {
    /** Directory currently prepended, or null. */
    get active() {
      return active
    },

    /**
     * PATH as it was before any shadow, so the resolver never mistakes its own prefix for a
     * genuine PATH candidate (that would feed back into the next resolution).
     */
    get basePath() {
      return original
    },

    /**
     * Prepend the interpreter's directory to PATH.
     * @param {string} interpreter - Absolute interpreter path.
     * @returns {boolean} Whether PATH changed.
     */
    apply(interpreter) {
      const dir = dirname(interpreter)
      if (dir === active) return false
      active = dir
      env[key] = `${dir}${delimiter}${original}`
      return true
    },

    /**
     * Restore the PATH snapshot taken at construction.
     * @returns {boolean} Whether PATH changed.
     */
    clear() {
      if (active === null) return false
      active = null
      env[key] = original
      return true
    },
  }
}
