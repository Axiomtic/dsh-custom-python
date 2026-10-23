/**
 * Host half of the bundle: configuration, the resolver, and the `python` tool.
 */

import { normalizeConfig } from './lib/config.js'
import { createIo } from './lib/io.js'
import { Resolver } from './lib/resolver.js'
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
  const io = createIo({ config: settings })
  const resolver = new Resolver({ config: settings, io })
  /** Session-scoped explicit choices (L1); process-local and cleared on unload. */
  const sessions = new Map()

  ctx.tools.register(createPythonTool({ ctx, settings, resolver, sessions }))

  ctx.effect(() => () => {
    sessions.clear()
    resolver.invalidate()
  })
}
