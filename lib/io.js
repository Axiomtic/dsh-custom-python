/**
 * The real filesystem/environment port. Everything OS-specific that the resolver cannot
 * reason about purely lives here, so `resolver.js` stays testable with a fake port.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { realpath as realpathAsync } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { delimiter, dirname, join } from 'node:path'
import { homedir } from 'node:os'
import { condaInterpreter, isWindows, pathInterpreterNames } from './platform.js'

/** Version probe: one interpreter start, one line of output, no imports beyond `sys`. */
const PROBE_ARGS = ['-c', 'import sys;print(sys.version.split()[0])']

/**
 * Locate the bundled interpreter without touching `process.env` mutably.
 * `DSH_HOME` is present in shell sessions but not necessarily in the Host process, so the
 * conventional home directory is the fallback rather than a reason to report "missing".
 * @param {any} config
 * @param {{env?: Record<string, string|undefined>, home?: string}} [context]
 * @returns {string|null}
 */
export function bundledInterpreterPath(config, { env = process.env, home = homedir() } = {}) {
  if (config.bundledInterpreter) return config.bundledInterpreter
  const dshHome = env.DSH_HOME ?? join(home, '.dsh')
  const root = join(dshHome, 'dsh-runtimes', 'dsh-primary-runtime', 'dependencies', 'python')
  const path = isWindows ? join(root, 'python.exe') : join(root, 'bin', 'python')
  return existsSync(path) ? path : null
}

/**
 * @param {object} options
 * @param {any} options.config - Normalised settings (`probeTimeoutMs`, `bundledInterpreter`).
 * @param {Record<string, string|undefined>} [options.env] - Environment source, injectable for tests.
 * @param {string} [options.home] - Home directory override, injectable for tests.
 * @param {string} [options.basePath] - PATH to scan for interpreters, before any shadow prefix.
 */
export function createIo({ config, env = process.env, home = homedir(), basePath }) {
  return {
    /**
     * @param {string} path
     * @returns {Promise<string|null>}
     */
    async realpath(path) {
      try {
        return await realpathAsync(path)
      } catch {
        return null
      }
    },

    /**
     * Run the interpreter long enough to prove it starts and to read its version.
     * A store-alias stub, a half-built venv, or a denied executable all fail here.
     * @param {string} path
     * @returns {Promise<{version: string}|null>}
     */
    async probe(path) {
      const result = spawnSync(path, PROBE_ARGS, {
        timeout: config.probeTimeoutMs,
        encoding: 'utf8',
        windowsHide: true,
      })
      if (result.error || result.status !== 0) return null
      const version = String(result.stdout ?? '').trim().split(/\r?\n/).pop() ?? ''
      return /^\d+\.\d+/.test(version) ? { version } : null
    },

    /**
     * Read `<cwd>/.dsh/python.json`; a malformed file is treated as absent.
     * @param {string} cwd
     * @returns {Promise<{interpreter?: string, conda?: string}|null>}
     */
    async workspaceSelection(cwd) {
      const file = join(cwd, '.dsh', 'python.json')
      if (!existsSync(file)) return null
      try {
        const parsed = JSON.parse(readFileSync(file, 'utf8'))
        if (!parsed || typeof parsed !== 'object') return null
        const interpreter = typeof parsed.interpreter === 'string' && parsed.interpreter.length > 0 ? parsed.interpreter : undefined
        const conda = typeof parsed.conda === 'string' && parsed.conda.length > 0 ? parsed.conda : undefined
        return interpreter || conda ? { interpreter, conda } : null
      } catch {
        return null
      }
    },

    /**
     * The activation variables a parent terminal would have exported.
     * @returns {Promise<Record<string, string|undefined>>}
     */
    async env() {
      return { VIRTUAL_ENV: env.VIRTUAL_ENV, CONDA_PREFIX: env.CONDA_PREFIX }
    },

    /**
     * Every interpreter-shaped file reachable through PATH, in PATH order.
     * @returns {Promise<string[]>}
     */
    async pathInterpreters() {
      const raw = basePath ?? env.PATH ?? env.Path ?? ''
      const dirs = raw.split(delimiter).filter((dir) => dir.length > 0)
      const found = []
      for (const dir of dirs) {
        for (const name of pathInterpreterNames()) {
          const candidate = join(dir, name)
          if (existsSync(candidate)) found.push(candidate)
        }
      }
      return found
    },

    /**
     * Map a conda environment name to its interpreter by looking in the usual places.
     * @param {string} name
     * @returns {Promise<string|null>}
     */
    async condaEnv(name) {
      const bases = []
      if (env.CONDA_PREFIX) bases.push(dirname(env.CONDA_PREFIX))
      if (env.CONDA_EXE) bases.push(dirname(dirname(env.CONDA_EXE)))
      bases.push(join(home, 'miniconda3'), join(home, 'anaconda3'), join(home, 'miniforge3'))
      for (const base of bases) {
        if (name === 'base') {
          const baseInterpreter = condaInterpreter(base)
          if (existsSync(baseInterpreter)) return baseInterpreter
          continue
        }
        const interpreter = condaInterpreter(join(base, 'envs', name))
        if (existsSync(interpreter)) return interpreter
      }
      return null
    },

    /**
     * Interpreters offered for an explicit pick but never auto-selected: conda bases and
     * their environments. The precedence chain stays untouched — these only populate the
     * chooser, so "no silent guessing" (ADR-0004) still holds.
     * @returns {Promise<string[]>}
     */
    async suggestedInterpreters() {
      const roots = []
      if (env.CONDA_PREFIX) roots.push(dirname(env.CONDA_PREFIX))
      roots.push(join(home, 'miniconda3'), join(home, 'anaconda3'), join(home, 'miniforge3'))

      const found = []
      const push = (path) => {
        if (path && existsSync(path) && !found.includes(path)) found.push(path)
      }

      for (const root of roots) {
        push(condaInterpreter(root))
        const envsDir = join(root, 'envs')
        if (!existsSync(envsDir)) continue
        let entries = []
        try {
          entries = readdirSync(envsDir, { withFileTypes: true })
        } catch {
          continue
        }
        for (const entry of entries) {
          if (!entry.isDirectory()) continue
          push(condaInterpreter(join(envsDir, entry.name)))
        }
      }
      return found
    },

    /**
     * The bundled runtime interpreter, or null when it cannot be located.
     * @returns {Promise<string|null>}
     */
    async bundled() {
      return bundledInterpreterPath(config, { env, home })
    },
  }
}
