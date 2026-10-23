/**
 * The resolver: a deterministic, layer-by-layer chooser of one Python interpreter.
 *
 * The core is pure orchestration over an injected {@link Io} port, so every layer can be
 * tested without touching a real filesystem or spawning a real interpreter.
 *
 * Layer order follows docs/adr/0004-precedence-by-layer.md: within a layer the interpreters
 * are de-duplicated by real path, and only a layer that still holds more than one usable
 * candidate is reported as ambiguous. A layer with candidates that all fail the probe is
 * skipped, so a broken `.venv` never blocks a working PATH interpreter.
 */

import { condaInterpreter, venvInterpreters } from './platform.js'
import { join } from 'node:path'

/**
 * @typedef {object} Interpreter
 * @property {string} path - The path as discovered (kept for display).
 * @property {string} real - Resolved real path used for de-duplication.
 * @property {string|null} version - `3.13.2` once probed, otherwise null.
 */

/**
 * @typedef {object} Resolution
 * @property {'resolved'|'ambiguous'|'missing'} status
 * @property {string} [layer] - Layer id such as `L2`.
 * @property {string} [label] - Human label of the layer.
 * @property {string} [interpreter] - Absolute path of the chosen interpreter.
 * @property {string} [realpath]
 * @property {string} [version]
 * @property {Interpreter[]} [candidates] - Present when the status is `ambiguous`.
 */

/**
 * The filesystem/environment port the resolver depends on.
 * @typedef {object} Io
 * @property {(path: string) => Promise<string|null>} realpath
 * @property {(path: string) => Promise<{version: string}|null>} probe
 * @property {(cwd: string) => Promise<{interpreter?: string, conda?: string}|null>} workspaceSelection
 * @property {() => Promise<Record<string, string|undefined>>} env
 * @property {() => Promise<string[]>} pathInterpreters
 * @property {(name: string) => Promise<string|null>} condaEnv
 * @property {() => Promise<string|null>} bundled
 */

/**
 * @typedef {object} Layer
 * @property {string} id
 * @property {string} label
 * @property {(input: {config: any, cwd: string, session: any, io: Io}) => Promise<string[]>} collect
 */

/** @type {Layer[]} */
export const LAYERS = [
  {
    id: 'L1',
    label: '会话选择',
    collect: async ({ session }) => (session?.interpreter ? [session.interpreter] : []),
  },
  {
    id: 'L2',
    label: '工作区选择',
    collect: async ({ config, cwd, io }) => {
      if (!config.workspaceFile) return []
      const selection = await io.workspaceSelection(cwd)
      if (!selection) return []
      if (selection.interpreter) return [selection.interpreter]
      if (selection.conda) {
        const path = await io.condaEnv(selection.conda)
        return path ? [path] : []
      }
      return []
    },
  },
  {
    id: 'L3',
    label: 'profile 默认',
    collect: async ({ config }) => (config.defaultInterpreter ? [config.defaultInterpreter] : []),
  },
  {
    id: 'L4',
    label: '已激活环境',
    collect: async ({ io }) => {
      const env = await io.env()
      const found = []
      if (env.VIRTUAL_ENV) found.push(...venvInterpreters(env.VIRTUAL_ENV))
      if (env.CONDA_PREFIX) found.push(condaInterpreter(env.CONDA_PREFIX))
      return found
    },
  },
  {
    id: 'L5',
    label: '工作区 .venv',
    collect: async ({ config, cwd }) => (config.venv ? venvInterpreters(join(cwd, '.venv')) : []),
  },
  {
    id: 'L6',
    label: 'PATH',
    collect: async ({ io }) => io.pathInterpreters(),
  },
  {
    id: 'L7',
    label: '内置 runtime',
    collect: async ({ io }) => {
      const bundled = await io.bundled()
      return bundled ? [bundled] : []
    },
  },
]

/**
 * Collapse the same interpreter discovered through several paths.
 * @param {string[]} paths
 * @param {Io} io
 * @returns {Promise<Array<{path: string, real: string}>>}
 */
export async function dedupeByRealpath(paths, io) {
  const seen = new Set()
  const unique = []
  for (const path of paths) {
    if (typeof path !== 'string' || path.length === 0) continue
    const real = (await io.realpath(path)) ?? path
    const key = process.platform === 'win32' ? real.toLowerCase() : real
    if (seen.has(key)) continue
    seen.add(key)
    unique.push({ path, real })
  }
  return unique
}

export class Resolver {
  /**
   * @param {object} options
   * @param {any} options.config - Normalised settings.
   * @param {Io} options.io
   * @param {() => number} [options.now] - Injectable clock for cache tests.
   */
  constructor({ config, io, now = () => Date.now() }) {
    this.config = config
    this.io = io
    this.now = now
    /** @type {Map<string, {info: {version: string}|null, at: number}>} */
    this.cache = new Map()
  }

  /**
   * Probe one interpreter, memoised for `cacheTtlMs`.
   * @param {string} real
   * @param {string} path
   * @returns {Promise<{version: string}|null>}
   */
  async probe(real, path) {
    const key = process.platform === 'win32' ? real.toLowerCase() : real
    const hit = this.cache.get(key)
    const at = this.now()
    if (hit && at - hit.at < this.config.cacheTtlMs) return hit.info
    let info = null
    try {
      info = await this.io.probe(path)
    } catch {
      info = null
    }
    this.cache.set(key, { info, at })
    return info
  }

  /**
   * Collect every layer's candidates with their probe outcome, without deciding.
   * Used by the `list` action and by tests.
   * @param {{cwd: string, session?: any}} input
   * @returns {Promise<Array<{id: string, label: string, candidates: Interpreter[]}>>}
   */
  async inventory({ cwd, session }) {
    const layers = []
    for (const layer of LAYERS) {
      const raw = await layer.collect({ config: this.config, cwd, session, io: this.io })
      const unique = await dedupeByRealpath(raw, this.io)
      /** @type {Interpreter[]} */
      const candidates = []
      for (const candidate of unique) {
        const info = await this.probe(candidate.real, candidate.path)
        candidates.push({ path: candidate.path, real: candidate.real, version: info?.version ?? null })
      }
      layers.push({ id: layer.id, label: layer.label, candidates })
    }
    return layers
  }

  /**
   * Choose the interpreter for this session and working directory.
   * @param {{cwd: string, session?: any}} input
   * @returns {Promise<Resolution>}
   */
  async resolve({ cwd, session }) {
    for (const layer of LAYERS) {
      const raw = await layer.collect({ config: this.config, cwd, session, io: this.io })
      if (raw.length === 0) continue
      const unique = await dedupeByRealpath(raw, this.io)
      /** @type {Interpreter[]} */
      const usable = []
      for (const candidate of unique) {
        const info = await this.probe(candidate.real, candidate.path)
        if (!info) continue
        usable.push({ path: candidate.path, real: candidate.real, version: info.version })
      }
      if (usable.length === 0) continue
      if (usable.length === 1) {
        const [only] = usable
        return {
          status: 'resolved',
          layer: layer.id,
          label: layer.label,
          interpreter: only.path,
          realpath: only.real,
          version: only.version ?? undefined,
        }
      }
      return { status: 'ambiguous', layer: layer.id, label: layer.label, candidates: usable }
    }
    return { status: 'missing' }
  }

  /** Drop memoised probe results; used after an explicit switch. */
  invalidate() {
    this.cache.clear()
  }

  /**
   * Verify one interpreter path chosen by hand, so a bad `use` fails immediately instead of
   * poisoning every later call in the session.
   * @param {string} path
   * @returns {Promise<{real: string, version: string}|null>}
   */
  async check(path) {
    const real = (await this.io.realpath(path)) ?? path
    const info = await this.probe(real, path)
    return info ? { real, version: info.version } : null
  }
}
