/**
 * Process execution and failure translation for the `python` tool.
 *
 * The tool's whole value is turning a raw traceback into one actionable line, so the
 * parsing and the import-name → distribution-name table live together here.
 */

import { spawn } from 'node:child_process'

/** DeepSeek Harness caps a single tool result; keep the tail, which holds the error. */
const OUTPUT_LIMIT = 64 * 1024

/**
 * Import names whose distribution name differs. Anything absent is passed through as-is;
 * guessing worse than the interpreter's own error would only add noise.
 */
export const IMPORT_TO_DISTRIBUTION = {
  yaml: 'pyyaml',
  PIL: 'pillow',
  cv2: 'opencv-python',
  sklearn: 'scikit-learn',
  bs4: 'beautifulsoup4',
  dateutil: 'python-dateutil',
  dotenv: 'python-dotenv',
  jwt: 'pyjwt',
  OpenSSL: 'pyopenssl',
  serial: 'pyserial',
  usb: 'pyusb',
  fitz: 'pymupdf',
  docx: 'python-docx',
  pptx: 'python-pptx',
  magic: 'python-magic',
}

const MISSING_PATTERNS = [
  /ModuleNotFoundError: No module named '([^']+)'/u,
  /ImportError: No module named '([^']+)'/u,
  /ModuleNotFoundError: No module named "([^"]+)"/u,
]

/**
 * Extract the top-level import name from a Python module path.
 * @param {string} moduleName
 * @returns {string}
 */
function topLevel(moduleName) {
  return moduleName.split('.')[0]
}

/**
 * Find the module a failed import names, if the failure is a missing import at all.
 * @param {string} stderr
 * @returns {string|null}
 */
export function missingModule(stderr) {
  for (const pattern of MISSING_PATTERNS) {
    const match = pattern.exec(stderr)
    if (match) return topLevel(match[1])
  }
  return null
}

/**
 * The single command that fixes the reported failure.
 * @param {string} interpreter - Absolute interpreter path; a bare `pip` could target another environment.
 * @param {string} moduleName
 * @returns {string}
 */
export function fixCommand(interpreter, moduleName) {
  const distribution = IMPORT_TO_DISTRIBUTION[moduleName] ?? moduleName
  return `"${interpreter}" -m pip install ${distribution}`
}

/**
 * Trim output to the tail that carries the failure, marking the truncation explicitly.
 * @param {string} text
 * @returns {string}
 */
function clip(text) {
  if (text.length <= OUTPUT_LIMIT) return text
  return `[... ${text.length - OUTPUT_LIMIT} characters of output trimmed ...]\n${text.slice(-OUTPUT_LIMIT)}`
}

/**
 * Run one interpreter invocation.
 * @param {object} options
 * @param {string} options.interpreter
 * @param {string[]} options.argv - Arguments after the interpreter path.
 * @param {string} options.cwd
 * @param {number} options.timeoutMs
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<{exitCode: number|null, stdout: string, stderr: string, timedOut: boolean, aborted: boolean}>}
 */
export function runPython({ interpreter, argv, cwd, timeoutMs, signal }) {
  return new Promise((resolve) => {
    const chunks = { stdout: [], stderr: [] }
    let settled = false
    let timedOut = false
    let aborted = false

    const child = spawn(interpreter, argv, { cwd, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })

    const finish = (exitCode) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      signal?.removeEventListener?.('abort', onAbort)
      resolve({
        exitCode,
        stdout: clip(chunks.stdout.join('')),
        stderr: clip(chunks.stderr.join('')),
        timedOut,
        aborted,
      })
    }

    const timer = setTimeout(() => {
      timedOut = true
      child.kill()
    }, timeoutMs)

    const onAbort = () => {
      aborted = true
      child.kill()
    }
    signal?.addEventListener?.('abort', onAbort, { once: true })

    child.stdout.on('data', (chunk) => chunks.stdout.push(String(chunk)))
    child.stderr.on('data', (chunk) => chunks.stderr.push(String(chunk)))
    child.on('error', (error) => {
      chunks.stderr.push(`${error.message}\n`)
      finish(null)
    })
    child.on('close', (code) => finish(code))
  })
}

/**
 * Build the argument vector for one invocation.
 * @param {{code?: string, script?: string, args?: string[]}} input
 * @returns {string[]}
 */
export function buildArgv({ code, script, args }) {
  if (typeof code === 'string' && code.length > 0) return ['-c', code]
  if (typeof script === 'string' && script.length > 0) return [script, ...(args ?? [])]
  throw new Error('custom-python: python() needs either `code` or `script`')
}
