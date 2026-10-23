import assert from 'node:assert/strict'
import test from 'node:test'

import { buildArgv, fixCommand, missingModule, runPython } from '../lib/runner.js'
import { renderText } from '../lib/tool.js'

test('a missing module is extracted from the traceback', () => {
  const stderr = [
    'Traceback (most recent call last):',
    '  File "<string>", line 1, in <module>',
    "ModuleNotFoundError: No module named 'yaml'",
  ].join('\n')
  assert.equal(missingModule(stderr), 'yaml')
})

test('a submodule path is reduced to its top-level import', () => {
  assert.equal(missingModule("ModuleNotFoundError: No module named 'google.protobuf'"), 'google')
})

test('an unrelated failure is not reported as a missing module', () => {
  assert.equal(missingModule('SyntaxError: invalid syntax'), null)
})

test('known import names map to their distribution names', () => {
  assert.equal(fixCommand('/usr/bin/python3', 'yaml'), '"/usr/bin/python3" -m pip install pyyaml')
  assert.equal(fixCommand('/usr/bin/python3', 'PIL'), '"/usr/bin/python3" -m pip install pillow')
})

test('an unknown import name is passed through instead of guessed', () => {
  assert.equal(fixCommand('/usr/bin/python3', 'someobscurelib'), '"/usr/bin/python3" -m pip install someobscurelib')
})

test('argv covers inline code, scripts, and script arguments', () => {
  assert.deepEqual(buildArgv({ code: 'print(1)' }), ['-c', 'print(1)'])
  assert.deepEqual(buildArgv({ script: 'a.py', args: ['--x'] }), ['a.py', '--x'])
  assert.throws(() => buildArgv({}), /needs either/u)
})

test('running the bundled interpreter returns its stdout and exit code', async () => {
  const interpreter = process.env.DSH_HOME
    ? `${process.env.DSH_HOME}/dsh-runtimes/dsh-primary-runtime/dependencies/python/python.exe`
    : null
  if (!interpreter) return
  const outcome = await runPython({ interpreter, argv: ['-c', 'print(40 + 2)'], cwd: process.cwd(), timeoutMs: 15_000 })
  assert.equal(outcome.exitCode, 0)
  assert.equal(outcome.stdout.trim(), '42')
})

test('a failure renders as three lines, never a traceback dump', () => {
  const text = renderText({
    status: 'missing_module',
    action: 'run',
    interpreter: 'C:\\py\\python.exe',
    version: '3.12.14',
    missing_modules: ['yaml'],
    fix: '"C:\\py\\python.exe" -m pip install pyyaml',
  })
  const lines = text.split('\n')
  assert.equal(lines.length, 3)
  assert.match(lines[0], /missing module 'yaml'/u)
  assert.match(lines[2], /pip install pyyaml/u)
})
