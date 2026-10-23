/**
 * HTTP routes the Client half calls.
 *
 * Two scopes, deliberately separate:
 * - the settings page edits the **global** default (one select, immediate effect);
 * - the composer badge edits the **current session** override, which falls back to the
 *   global default when unset. That is what keeps two sessions from inheriting each other's
 *   interpreter.
 */

import { bundledInterpreterPath } from './io.js'
import { describeInterpreter, formatInterpreter } from './labels.js'
import { isOnboarded, markOnboarded, readSettings, writeSettings } from './store.js'
import { sessionChoice } from './session.js'

/** The value that means "pretend this plugin is not installed". */
export const OFF = ''

/**
 * @param {object} options
 * @param {any} options.ctx
 * @param {any} options.settings - Mutable normalised settings.
 * @param {import('./resolver.js').Resolver} options.resolver
 * @param {Map<string, string>} options.sessions
 * @param {{clear(): void, active: string|null}} options.shadow
 * @param {any} options.io
 * @param {(enabled: boolean) => void} options.setEnabled - Register or withdraw the tool.
 */
export function registerRoutes({ ctx, settings, resolver, sessions, shadow, io, setEnabled }) {
  const state = { cwd: null }

  ctx.inject(['webServer'], (sub) => {
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
      path: '/custom-python/setting',
      handler: async (req, res) => {
        const body = await readBody(req)
        const value = typeof body.value === 'string' ? body.value : null
        if (value === null) return send(res, 400, { error: 'value is required' })

        if (value === OFF) {
          writeSettings({ enabled: false })
          settings.enabled = false
          shadow.clear()
          setEnabled(false)
        } else {
          const checked = await resolver.check(value)
          if (!checked) return send(res, 400, { error: `cannot start ${value} as Python` })
          writeSettings({ enabled: true, defaultInterpreter: value })
          settings.enabled = true
          settings.defaultInterpreter = value
          resolver.invalidate()
          setEnabled(true)
          // The global default is what the process-wide PATH shadow follows.
          if (value === bundledInterpreterPath(settings)) shadow.clear()
          else shadow.apply(value)
        }

        markOnboarded()
        send(res, 200, await snapshot({ settings, resolver, sessions, cwd: state.cwd ?? process.cwd(), session: 'process', io }))
      },
    })

    mount({
      kind: 'exact',
      path: '/custom-python/session',
      handler: async (req, res) => {
        const body = await readBody(req)
        const session = typeof body.session === 'string' && body.session.length > 0 ? body.session : null
        const value = typeof body.value === 'string' ? body.value : null
        if (!session) return send(res, 400, { error: 'session is required' })
        if (value === null) return send(res, 400, { error: 'value is required' })

        if (value === OFF) {
          sessions.delete(session)
        } else {
          const checked = await resolver.check(value)
          if (!checked) return send(res, 400, { error: `cannot start ${value} as Python` })
          sessions.set(session, value)
        }
        // The PATH shadow belongs to the global default; a session override must not move it.
        resolver.invalidate()
        send(res, 200, await snapshot({ settings, resolver, sessions, cwd: state.cwd ?? process.cwd(), session, io }))
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
 * @param {{settings: any, resolver: any, sessions: Map<string,string>, cwd: string, session: string, io?: any}} input
 */
export async function snapshot({ settings, resolver, sessions, cwd, session, io }) {
  const enabled = settings.enabled !== false
  const bundled = bundledInterpreterPath(settings)
  const chosen = enabled ? sessionChoice(sessions, session) : undefined
  const resolution = await resolver.resolve({ cwd, session: chosen })
  const layers = await resolver.inventory({ cwd, session: chosen })
  const describe = (path) => describeInterpreter(path, { bundled, condaPrefix: process.env.CONDA_PREFIX })

  /** @type {Array<{index:number,path:string,display:string,usable:boolean}>} */
  const candidates = []
  const seen = new Set()
  for (const layer of layers) {
    for (const candidate of layer.candidates) {
      if (seen.has(candidate.path)) continue
      seen.add(candidate.path)
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
      if (seen.has(path)) continue
      const checked = await resolver.check(path)
      if (!checked) continue
      seen.add(path)
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

  const usable = candidates.filter((candidate) => candidate.usable).map((candidate) => ({ value: candidate.path, label: candidate.display }))
  const globalSelected = !enabled
    ? OFF
    : settings.defaultInterpreter && candidates.some((candidate) => candidate.path === settings.defaultInterpreter)
      ? settings.defaultInterpreter
      : settings.defaultInterpreter ?? (resolution.status === 'resolved' ? resolution.interpreter : OFF)

  const override = sessions.get(session)
  const sessionSelected = override ?? OFF
  const globalLabel =
    (usesGlobal(globalSelected) && candidates.find((candidate) => candidate.path === globalSelected)?.display) ||
    (globalSelected === OFF ? '关闭自定义 Python' : '已选')

  return {
    enabled,
    sessionId: session,
    global: {
      selected: globalSelected,
      options: [{ value: OFF, label: '关闭自定义 Python' }, ...usable],
    },
    session: {
      selected: sessionSelected,
      options: [{ value: OFF, label: `跟随全局默认（${globalLabel}）` }, ...usable],
    },
    resolution: {
      ...resolution,
      label:
        resolution.status === 'resolved'
          ? {
              kind: describe(resolution.interpreter).kind,
              name: describe(resolution.interpreter).name,
              display: formatInterpreter(describe(resolution.interpreter), resolution.version),
            }
          : null,
    },
    shadow: Boolean(settings.shadow),
    firstRun: !isOnboarded() && !readSettings().defaultInterpreter,
  }
}

function usesGlobal(value) {
  return typeof value === 'string' && value.length > 0
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
