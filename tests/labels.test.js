import assert from 'node:assert/strict'
import test from 'node:test'

import { describeInterpreter, formatInterpreter } from '../lib/labels.js'

test('a conda environment name wins over its absolute path', () => {
  assert.deepEqual(describeInterpreter('/opt/miniconda3/envs/py311/bin/python'), { kind: 'conda', name: 'py311' })
})

test('a conda base install is still conda, named after its directory', () => {
  assert.deepEqual(describeInterpreter('/opt/miniconda3/bin/python'), { kind: 'conda', name: 'miniconda3' })
})

test('a .venv directory is reported as venv, not as a path', () => {
  assert.deepEqual(describeInterpreter('/work/project/.venv/bin/python'), { kind: 'venv', name: '.venv' })
})

test('an arbitrary virtualenv directory is recognised by name', () => {
  assert.deepEqual(describeInterpreter('/work/project/venv/bin/python'), { kind: 'venv', name: 'venv' })
})

test('the bundled runtime is labelled by role, not by path', () => {
  const context = { bundled: '/home/u/.dsh/dsh-runtimes/dsh-primary-runtime/dependencies/python/python.exe' }
  assert.deepEqual(describeInterpreter(context.bundled, context), { kind: 'bundled', name: 'runtime' })
})

test('anything else stays a system interpreter named after its directory', () => {
  assert.deepEqual(describeInterpreter('/usr/bin/python3'), { kind: 'system', name: 'bin' })
})

test('the display line reads as kind, name, version', () => {
  assert.equal(formatInterpreter({ kind: 'conda', name: 'miniconda3' }, '3.13.2'), 'conda · miniconda3 3.13.2')
  assert.equal(formatInterpreter({ kind: 'bundled', name: 'runtime' }, '3.12.14'), 'bundled 3.12.14')
})
