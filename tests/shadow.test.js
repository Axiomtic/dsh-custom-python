import assert from 'node:assert/strict'
import { delimiter, dirname } from 'node:path'
import test from 'node:test'

import { createShadow } from '../lib/shadow.js'

test('applying prepends the interpreter directory without touching the rest', () => {
  const env = { PATH: '/usr/bin:/bin' }
  const shadow = createShadow({ env })
  const interpreter = '/opt/py/bin/python'
  assert.equal(shadow.apply(interpreter), true)
  assert.equal(env.PATH, `${dirname(interpreter)}${delimiter}/usr/bin:/bin`)
})

test('the same directory is not prepended twice', () => {
  const env = { PATH: '/usr/bin' }
  const shadow = createShadow({ env })
  shadow.apply('/opt/py/bin/python')
  const once = env.PATH
  assert.equal(shadow.apply('/opt/py/bin/python3'), false)
  assert.equal(env.PATH, once)
})

test('a different interpreter replaces the prefix instead of stacking', () => {
  const env = { PATH: '/usr/bin' }
  const shadow = createShadow({ env })
  shadow.apply('/opt/a/bin/python')
  shadow.apply('/opt/b/bin/python')
  assert.equal(env.PATH, `/opt/b/bin${delimiter}/usr/bin`)
})

test('clearing restores the original PATH exactly', () => {
  const env = { PATH: '/usr/bin:/bin' }
  const shadow = createShadow({ env })
  shadow.apply('/opt/py/bin/python')
  assert.equal(shadow.clear(), true)
  assert.equal(env.PATH, '/usr/bin:/bin')
  assert.equal(shadow.clear(), false)
})
