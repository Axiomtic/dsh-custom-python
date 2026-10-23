import assert from 'node:assert/strict'
import { join } from 'node:path'
import test from 'node:test'

import { normalizeConfig } from '../lib/config.js'
import { Resolver, dedupeByRealpath } from '../lib/resolver.js'
import { venvInterpreters } from '../lib/platform.js'

/**
 * Build a fake Io port. `reals` maps a discovered path to its real path, `versions` maps a
 * real path to a version string; anything absent from `versions` fails the probe.
 */
function makeIo({ reals = {}, versions = {}, selection = null, envVars = {}, pathList = [], conda = {}, bundled = null } = {}) {
  const probed = []
  return {
    probed,
    async realpath(path) {
      return reals[path] ?? path
    },
    async probe(path) {
      probed.push(path)
      const key = reals[path] ?? path
      return versions[key] ? { version: versions[key] } : null
    },
    async workspaceSelection() {
      return selection
    },
    async env() {
      return envVars
    },
    async pathInterpreters() {
      return pathList
    },
    async condaEnv(name) {
      return conda[name] ?? null
    },
    async bundled() {
      return bundled
    },
  }
}

const config = normalizeConfig({})

test('workspace selection beats everything below it', async () => {
  const io = makeIo({
    selection: { interpreter: '/m/sel/python' },
    versions: { '/m/sel/python': '3.13.2', '/m/path/python': '3.12.1' },
    pathList: ['/m/path/python'],
  })
  const resolution = await new Resolver({ config, io }).resolve({ cwd: '/work' })
  assert.equal(resolution.status, 'resolved')
  assert.equal(resolution.layer, 'L2')
  assert.equal(resolution.interpreter, '/m/sel/python')
  assert.equal(resolution.version, '3.13.2')
})

test('an explicit session switch outranks the workspace file', async () => {
  const io = makeIo({
    selection: { interpreter: '/m/sel/python' },
    versions: { '/m/sel/python': '3.13.2', '/m/session/python': '3.14.0' },
  })
  const resolution = await new Resolver({ config, io }).resolve({ cwd: '/work', session: { interpreter: '/m/session/python' } })
  assert.equal(resolution.layer, 'L1')
  assert.equal(resolution.interpreter, '/m/session/python')
})

test('the same interpreter found twice inside a layer is not ambiguous', async () => {
  const io = makeIo({
    reals: { '/m/path/python': '/real/python', '/m/path/python3': '/real/python' },
    versions: { '/real/python': '3.13.2' },
    pathList: ['/m/path/python', '/m/path/python3'],
  })
  const resolution = await new Resolver({ config, io }).resolve({ cwd: '/work' })
  assert.equal(resolution.status, 'resolved')
  assert.equal(resolution.layer, 'L6')
  assert.equal(resolution.interpreter, '/m/path/python')
})

test('two distinct interpreters inside one layer are ambiguous and not guessed', async () => {
  const io = makeIo({
    versions: { '/m/a/python': '3.13.2', '/m/b/python': '3.11.9' },
    pathList: ['/m/a/python', '/m/b/python'],
  })
  const resolution = await new Resolver({ config, io }).resolve({ cwd: '/work' })
  assert.equal(resolution.status, 'ambiguous')
  assert.equal(resolution.layer, 'L6')
  assert.equal(resolution.candidates.length, 2)
})

test('a broken .venv is skipped instead of blocking the layer below', async () => {
  const cwd = '/work'
  const venv = venvInterpreters(join(cwd, '.venv'))[0]
  const io = makeIo({
    versions: { '/m/path/python': '3.13.2' },
    pathList: ['/m/path/python'],
  })
  const resolution = await new Resolver({ config, io }).resolve({ cwd })
  assert.equal(resolution.interpreter, '/m/path/python')
  assert.equal(resolution.layer, 'L6')
  assert.ok(io.probed.includes(venv), 'the venv candidate was probed and rejected')
})

test('an activated environment wins over .venv and PATH', async () => {
  const activated = venvInterpreters('/m/activated')[0]
  const io = makeIo({
    envVars: { VIRTUAL_ENV: '/m/activated' },
    versions: { [activated]: '3.12.7', '/m/path/python': '3.13.2' },
    pathList: ['/m/path/python'],
  })
  const resolution = await new Resolver({ config, io }).resolve({ cwd: '/work' })
  assert.equal(resolution.layer, 'L4')
  assert.equal(resolution.interpreter, activated)
})

test('zero usable candidates fall back to the bundled runtime', async () => {
  const io = makeIo({ versions: { '/bundled/python': '3.12.14' }, bundled: '/bundled/python' })
  const resolution = await new Resolver({ config, io }).resolve({ cwd: '/work' })
  assert.equal(resolution.status, 'resolved')
  assert.equal(resolution.layer, 'L7')
  assert.equal(resolution.interpreter, '/bundled/python')
})

test('no candidates anywhere is reported as missing, never thrown', async () => {
  const io = makeIo()
  const resolution = await new Resolver({ config, io }).resolve({ cwd: '/work' })
  assert.equal(resolution.status, 'missing')
})

test('probe results are cached across resolutions', async () => {
  const io = makeIo({ versions: { '/m/path/python': '3.13.2' }, pathList: ['/m/path/python'] })
  const resolver = new Resolver({ config: normalizeConfig({ venv: false }), io })
  await resolver.resolve({ cwd: '/work' })
  await resolver.resolve({ cwd: '/work' })
  assert.equal(io.probed.length, 1)
})

test('cache expires after the configured ttl', async () => {
  let clock = 0
  const io = makeIo({ versions: { '/m/path/python': '3.13.2' }, pathList: ['/m/path/python'] })
  const resolver = new Resolver({ config: normalizeConfig({ cacheTtlMs: 1000, venv: false }), io, now: () => clock })
  await resolver.resolve({ cwd: '/work' })
  clock = 2000
  await resolver.resolve({ cwd: '/work' })
  assert.equal(io.probed.length, 2)
})

test('disabling the workspace file skips that layer', async () => {
  const io = makeIo({
    selection: { interpreter: '/m/sel/python' },
    versions: { '/m/sel/python': '3.13.2', '/m/path/python': '3.12.1' },
    pathList: ['/m/path/python'],
  })
  const resolver = new Resolver({ config: normalizeConfig({ workspaceFile: false }), io })
  const resolution = await resolver.resolve({ cwd: '/work' })
  assert.equal(resolution.layer, 'L6')
})

test('a conda name in the workspace file resolves through the io port', async () => {
  const io = makeIo({
    selection: { conda: 'py311' },
    conda: { py311: '/m/conda/envs/py311/python' },
    versions: { '/m/conda/envs/py311/python': '3.11.9' },
  })
  const resolution = await new Resolver({ config, io }).resolve({ cwd: '/work' })
  assert.equal(resolution.layer, 'L2')
  assert.equal(resolution.interpreter, '/m/conda/envs/py311/python')
})

test('inventory reports every layer including rejected candidates', async () => {
  const io = makeIo({
    versions: { '/m/path/python': '3.13.2' },
    pathList: ['/m/path/python', '/m/dead/python'],
  })
  const layers = await new Resolver({ config, io }).inventory({ cwd: '/work' })
  const pathLayer = layers.find((layer) => layer.id === 'L6')
  assert.equal(pathLayer.candidates.length, 2)
  assert.equal(pathLayer.candidates.filter((candidate) => candidate.version).length, 1)
})

test('check() rejects a path that cannot start as Python', async () => {
  const io = makeIo({ versions: { '/ok/python': '3.13.2' } })
  const resolver = new Resolver({ config, io })
  assert.deepEqual(await resolver.check('/ok/python'), { real: '/ok/python', version: '3.13.2' })
  assert.equal(await resolver.check('/bad/python'), null)
})

test('dedupeByRealpath drops duplicates and preserves discovery order', async () => {
  const io = makeIo({ reals: { '/a': '/real', '/b': '/real', '/c': '/other' } })
  const unique = await dedupeByRealpath(['/a', '/b', '/c'], io)
  assert.deepEqual(unique.map((entry) => entry.path), ['/a', '/c'])
})
