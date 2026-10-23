/**
 * Human labels for an interpreter path.
 *
 * A raw absolute path is the worst thing to show a person choosing an environment: it says
 * nothing about *what* the path is. This turns a path into `kind` + `name`:
 * `conda / miniconda3`, `venv / .venv`, `bundled`, `system / Python313`.
 */

import { existsSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'

const CONDA_ROOTS = /(miniconda|anaconda|miniforge|mambaforge|conda)/iu
const VENV_NAMES = new Set(['.venv', 'venv', 'env', 'virtualenv'])
const BIN_DIRS = new Set(['bin', 'scripts'])

/**
 * @typedef {object} Label
 * @property {'conda'|'venv'|'bundled'|'system'} kind
 * @property {string} name - Environment name, never an absolute path.
 */

/**
 * The environment directory that owns an interpreter, tolerating both layouts:
 * `<env>/bin/python` on POSIX and `<env>\Scripts\python.exe` or `<env>\python.exe` on Windows.
 * @param {string} interpreter
 * @returns {string}
 */
function environmentDir(interpreter) {
  const dir = dirname(interpreter)
  return BIN_DIRS.has(basename(dir).toLowerCase()) ? dirname(dir) : dir
}

/**
 * @param {string} interpreter - Absolute interpreter path.
 * @param {{bundled?: string|null, condaPrefix?: string|undefined}} [context]
 * @returns {Label}
 */
export function describeInterpreter(interpreter, context = {}) {
  if (context.bundled && samePath(interpreter, context.bundled)) return { kind: 'bundled', name: 'runtime' }

  const env = environmentDir(interpreter)
  const envName = basename(env)

  // conda environments live in `<base>/envs/<name>`; the base itself is an environment too.
  if (basename(dirname(env)).toLowerCase() === 'envs') return { kind: 'conda', name: envName }
  if (context.condaPrefix && samePath(env, context.condaPrefix)) return { kind: 'conda', name: basename(context.condaPrefix) }
  if (CONDA_ROOTS.test(envName)) return { kind: 'conda', name: envName }

  if (VENV_NAMES.has(envName.toLowerCase())) return { kind: 'venv', name: envName }
  if (existsSync(join(env, 'pyvenv.cfg'))) return { kind: 'venv', name: envName }

  return { kind: 'system', name: basename(dirname(interpreter)) }
}

/**
 * One-line display form, for example `conda · miniconda3 3.13.2`.
 * @param {Label} label
 * @param {string|undefined} version
 * @returns {string}
 */
export function formatInterpreter(label, version) {
  const head = label.kind === 'bundled' ? 'bundled' : `${label.kind} · ${label.name}`
  return version ? `${head} ${version}` : head
}

/**
 * @param {string} a
 * @param {string} b
 */
function samePath(a, b) {
  const normalise = (value) => (process.platform === 'win32' ? value.toLowerCase() : value)
  return normalise(a) === normalise(b)
}
