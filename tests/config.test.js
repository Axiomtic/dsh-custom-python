import assert from 'node:assert/strict'
import test from 'node:test'

import { DEFAULTS, normalizeConfig } from '../lib/config.js'

test('an empty config activates with defaults', () => {
  assert.deepEqual(normalizeConfig(undefined), { ...DEFAULTS })
  assert.deepEqual(normalizeConfig({}), { ...DEFAULTS })
  assert.equal(normalizeConfig({}).shadow, true)
  assert.equal(normalizeConfig({}).autoInstall, false)
})

test('a relative interpreter is rejected at activation, not at first use', () => {
  assert.throws(() => normalizeConfig({ defaultInterpreter: 'python.exe' }), /absolute path/u)
  assert.throws(() => normalizeConfig({ bundledInterpreter: './python' }), /absolute path/u)
})

test('wrong types are rejected with an attributable message', () => {
  assert.throws(() => normalizeConfig({ shadow: 'yes' }), /config\.shadow must be a boolean/u)
  assert.throws(() => normalizeConfig({ cacheTtlMs: -1 }), /config\.cacheTtlMs/u)
  assert.throws(() => normalizeConfig([]), /config\.<root>/u)
})

test('absolute paths on both platforms are accepted verbatim', () => {
  const win = normalizeConfig({ defaultInterpreter: 'C:\\Python313\\python.exe' })
  assert.equal(win.defaultInterpreter, 'C:\\Python313\\python.exe')
  const posix = normalizeConfig({ defaultInterpreter: '/usr/bin/python3' })
  assert.equal(posix.defaultInterpreter, '/usr/bin/python3')
})
