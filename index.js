/**
 * Host half of the bundle: configuration, the resolver, the PATH shadow, the `python` tool,
 * and the HTTP routes the Client half renders.
 */

import { normalizeConfig } from './lib/config.js'
import { createIo } from './lib/io.js'
import { Resolver } from './lib/resolver.js'
import { registerRoutes } from './lib/server.js'
import { createShadow } from './lib/shadow.js'
import { readSettings } from './lib/store.js'
import { createPythonTool } from './lib/tool.js'

/** Cordis plugin identity. */
export const name = 'custom-python'

/** Services this plugin consumes: the tool registry, session lookup, and the session cwd. */
export const inject = ['tools', 'agents', 'workingDirectory']

/**
 * @param {any} ctx - Cordis context.
 * @param {unknown} config - The Loader row's `config`; every field is optional.
 */
export function apply(ctx, config) {
  const settings = normalizeConfig(config)
  const stored = readSettings()
  // The settings page writes `store`; "关闭自定义 Python" is `enabled: false`.
  settings.enabled = stored.enabled !== false
  if (stored.defaultInterpreter) settings.defaultInterpreter = stored.defaultInterpreter

  const shadow = createShadow()
  const io = createIo({ config: settings, basePath: shadow.basePath })
  const resolver = new Resolver({ config: settings, io })
  /** Per-session explicit choices; process-local and cleared on unload. */
  const sessions = new Map()

  /**
   * The tool's presence *is* the feature: withdrawing it while disabled is what makes the
   * plugin behave as if it were not installed.
   * @type {null | (() => void)}
   */
  let disposeTool = null
  const setEnabled = (enabled) => {
    if (enabled && !disposeTool) {
      const dispose = ctx.tools.register(createPythonTool({ ctx, settings, resolver, sessions, shadow }))
      disposeTool = typeof dispose === 'function' ? dispose : () => {}
      return
    }
    if (!enabled && disposeTool) {
      try {
        disposeTool()
      } catch {
        /* already withdrawn */
      }
      disposeTool = null
      sessions.clear()
      shadow.clear()
    }
  }

  setEnabled(settings.enabled)
  registerRoutes({ ctx, settings, resolver, sessions, shadow, io, setEnabled })

  ctx.effect(() => () => {
    sessions.clear()
    resolver.invalidate()
    shadow.clear()
  })
}
