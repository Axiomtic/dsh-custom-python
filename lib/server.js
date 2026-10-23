/**
 * HTTP routes the Client half calls.
 *
 * The Client renders the badge, the settings page and the first-run prompt; everything that
 * touches the filesystem or the resolver stays here. Routes are plain JSON over the existing
 * Web carrier, so no generated Remote plumbing is needed.
 */

import { bundledInterpreterPath } from './io.js'
import { describeInterpreter, formatInterpreter } from './labels.js'
import { isOnboarded, markOnboarded, readSettings, writeSettings } from './store.js'
import { sessionChoice } from './session.js'

/**
 * @param {object} options
 * @param {any} options.ctx
 * @param {any} options.settings - Mutable normalised settings (the file layer overrides the row).
 * @param {import('./resolver.js').Resolver} options.resolver
 * @param {Map<string, string>} options.sessions
 * @param {{apply(value: any): void, clear(): void, active: string|null}} options.shadow
 */
export function registerRoutes({ ctx, settings, resolver, sessions, shadow, io }) {
  /** Last directory the resolver ran for, so the badge has something to show before a call. */
  const state = { cwd: null }

  ctx.inject(['webServer'], (sub) => {
    /** Route disposers; a reloaded plugin must not leave a stale handler answering. */
    const disposers = []
    const mount = (route) => {
      const dispose = sub.webServer.register(route)
      if (typeof dispose === 'function') disposers.push(dispose)
    }
    sub.effect(() => () => {
      for (const dispose of disposers.splice(0)) {
        try {
          dispose()
        } catch {
          /* the carrier may already be gone during shutdown */
        }
      }
    })

    mount({
      kind: 'exact',
      path: '/custom-python/state',
      handler: async (req, res) => {
        const url = new URL(req.url ?? '/', 'http://localhost')
        const cwd = url.searchParams.get('cwd') || state.cwd || process.cwd()
        const session = url.searchParams.get('session') || 'process'
        state.cwd = cwd
        send(res, 200, await snapshot({ settings, resolver, sessions, cwd, session, io }))
      },
    })

    mount({
      kind: 'exact',
      path: '/custom-python/use',
      handler: async (req, res) => {
        const body = await readBody(req)
        const session = typeof body.session === 'string' && body.session.length > 0 ? body.session : 'process'
        const interpreter = typeof body.interpreter === 'string' ? body.interpreter : ''
        if (!interpreter) return send(res, 400, { error: 'interpreter is required' })
        const checked = await resolver.check(interpreter)
        if (!checked) return send(res, 400, { error: `cannot start ${interpreter} as Python` })
        sessions.set(session, interpreter)
        send(res, 200, await snapshot({ settings, resolver, sessions, cwd: state.cwd ?? process.cwd(), session, io }))
      },
    })

    mount({
      kind: 'exact',
      path: '/custom-python/default',
      handler: async (req, res) => {
        const body = await readBody(req)
        const interpreter = typeof body.interpreter === 'string' && body.interpreter.length > 0 ? body.interpreter : null
        if (interpreter !== null) {
          const checked = await resolver.check(interpreter)
          if (!checked) return send(res, 400, { error: `cannot start ${interpreter} as Python` })
        }
        writeSettings({ defaultInterpreter: interpreter })
        settings.defaultInterpreter = interpreter ?? undefined
        resolver.invalidate()
        markOnboarded()
        send(res, 200, await snapshot({ settings, resolver, sessions, cwd: state.cwd ?? process.cwd(), session: 'process', io }))
      },
    })

    mount({
      kind: 'exact',
      path: '/custom-python/skip',
      handler: async (_req, res) => {
        markOnboarded()
        send(res, 200, { ok: true })
      },
    })
  })
}

/**
 * @param {{settings: any, resolver: any, sessions: Map<string,string>, cwd: string, session: string}} input
 */
export async function snapshot({ settings, resolver, sessions, cwd, session, io }) {
  const chosen = sessionChoice(sessions, session)
  const resolution = await resolver.resolve({ cwd, session: chosen })
  const layers = await resolver.inventory({ cwd, session: chosen })
  const bundled = bundledInterpreterPath(settings)
  const describe = (path) => describeInterpreter(path, { bundled, condaPrefix: process.env.CONDA_PREFIX })
  const candidates = []
  for (const layer of layers) {
    for (const candidate of layer.candidates) {
      const label = describe(candidate.path)
      candidates.push({
        index: candidates.length + 1,
        path: candidate.path,
        version: candidate.version ?? undefined,
        layer: `${layer.id} ${layer.label}`,
        kind: label.kind,
        name: label.name,
        display: formatInterpreter(label, candidate.version ?? undefined),
        usable: candidate.version !== null,
      })
    }
  }
  // Offered for an explicit pick only: conda bases and their environments never win a layer.
  if (io && typeof io.suggestedInterpreters === 'function') {
    for (const path of await io.suggestedInterpreters()) {
      if (candidates.some((candidate) => candidate.path === path)) continue
      const checked = await resolver.check(path)
      if (!checked) continue
      const label = describe(path)
      candidates.push({
        index: candidates.length + 1,
        path,
        version: checked.version,
        layer: '可选候选',
        kind: label.kind,
        name: label.name,
        display: formatInterpreter(label, checked.version),
        usable: true,
      })
    }
  }

  const resolvedLabel =
    resolution.status === 'resolved'
      ? {
          kind: describe(resolution.interpreter).kind,
          name: describe(resolution.interpreter).name,
          display: formatInterpreter(describe(resolution.interpreter), resolution.version),
        }
      : null
  const stored = readSettings()
  return {
    defaultInterpreter: settings.defaultInterpreter ?? null,
    defaultDisplay: settings.defaultInterpreter
      ? (() => {
          const label = describe(settings.defaultInterpreter)
          return formatInterpreter(label, undefined)
        })()
      : null,
    storedDefault: stored.defaultInterpreter ?? null,
    session,
    cwd,
    resolution: { ...resolution, label: resolvedLabel },
    candidates,
    shadow: Boolean(settings.shadow),
    firstRun: !isOnboarded() && !settings.defaultInterpreter,
  }
}

function send(res, code, value) {
  const body = JSON.stringify(value)
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  res.end(body)
}

async function readBody(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  if (chunks.length === 0) return {}
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    return {}
  }
}
