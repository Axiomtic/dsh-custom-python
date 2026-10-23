/**
 * Platform-specific path conventions, kept in one place so the resolver core stays portable.
 */

import { join } from 'node:path'

export const isWindows = process.platform === 'win32'

/**
 * Interpreter paths inside a virtual environment directory.
 * @param {string} dir - Virtual environment root (for example `<cwd>/.venv`).
 * @returns {string[]} Candidate interpreter paths, most specific first.
 */
export function venvInterpreters(dir) {
  return isWindows
    ? [join(dir, 'Scripts', 'python.exe')]
    : [join(dir, 'bin', 'python'), join(dir, 'bin', 'python3')]
}

/**
 * File names a PATH directory may use to expose an interpreter.
 * @returns {string[]}
 */
export function pathInterpreterNames() {
  return isWindows ? ['python.exe', 'python3.exe'] : ['python', 'python3']
}

/**
 * Resolve the interpreter path inside a conda environment directory.
 * @param {string} envDir - Environment root such as `<base>/envs/py311`.
 * @returns {string}
 */
export function condaInterpreter(envDir) {
  return isWindows ? join(envDir, 'python.exe') : join(envDir, 'bin', 'python')
}
