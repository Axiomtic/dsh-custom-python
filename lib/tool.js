/**
 * The `python` tool: one deterministic door for running Python.
 *
 * It is deliberately the only place that decides "which interpreter", so the answer cannot
 * drift between callers. Success returns structured output plus the interpreter that ran it;
 * failure returns the same three things every time: what is missing, which interpreter was
 * used, and the exact command that fixes it.
 */

import { buildArgv, fixCommand, missingModule, runPython } from './runner.js'
import { bundledInterpreterPath } from './io.js'
import { effectiveChoice } from './session.js'

/**
 * Tool output must be lossless JSON: an `undefined` member is not JSON and is rejected by the
 * registry, so every optional field is dropped before returning.
 * @param {any} value
 * @returns {any}
 */
function lossless(value) {
  if (Array.isArray(value)) return value.map(lossless)
  if (value && typeof value === 'object') {
    const out = {}
    for (const [key, entry] of Object.entries(value)) {
      if (entry === undefined) continue
      out[key] = lossless(entry)
    }
    return out
  }
  return value
}

/**
 * @param {object} options
 * @param {any} options.ctx - Cordis context, used for session/cwd lookups.
 * @param {any} options.settings - Normalised plugin settings.
 * @param {import('./resolver.js').Resolver} options.resolver
 * @param {Map<string, string>} options.sessions - Per-session explicit choices.
 */
export function createPythonTool({ ctx, settings, resolver, sessions }) {
  return {
    name: 'python',
    description:
      'Run Python code or a script with the configured interpreter. Prefer this over invoking python in a shell. ' +
      'Returns interpreter, version, exit_code, stdout, stderr and, when an import is missing, the one command that installs it. ' +
      'Use action="status" to inspect which interpreter is active, action="list" to see every candidate, ' +
      'and bundled=true to force the bundled Office runtime.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        action: {
          type: 'string',
          enum: ['run', 'status', 'list'],
          description: 'Defaults to "run".',
        },
        code: { type: 'string', description: 'Inline Python source to execute.' },
        script: { type: 'string', description: 'Path to a .py file to execute.' },
        args: {
          type: 'array',
          items: { type: 'string' },
          description: 'Arguments passed to the script.',
        },
        bundled: { type: 'boolean', description: 'Force the bundled Office runtime (13 pinned packages).' },
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          status: { type: 'string' },
          action: { type: 'string' },
          interpreter: { type: 'string' },
          version: { type: 'string' },
          layer: { type: 'string' },
          label: { type: 'string' },
          exit_code: { type: 'number' },
          stdout: { type: 'string' },
          stderr: { type: 'string' },
          missing_modules: { type: 'array', items: { type: 'string' } },
          fix: { type: 'string' },
          timed_out: { type: 'boolean' },
          candidates: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                index: { type: 'number' },
                path: { type: 'string' },
                version: { type: 'string' },
                layer: { type: 'string' },
              },
            },
          },
          message: { type: 'string' },
        },
      },
      render: (_args, value) => [{ type: 'text', text: renderText(value) }],
    },
    async execute(args, exec) {
      return lossless(await runAction({ args, exec, ctx, settings, resolver, sessions }))
    },
  }
}


async function runAction({ args, exec, ctx, settings, resolver, sessions }) {
  const action = args.action ?? 'run'
  const { cwd, sessionId } = resolveScope(ctx)

  if (action === 'list') return listAction({ resolver, cwd, sessionId, sessions, settings })
  if (action === 'status') return statusAction({ resolver, cwd, sessionId, sessions, settings })

  const session = effectiveChoice(sessions, sessionId, settings, bundledInterpreterPath(settings))
  const resolution = args.bundled ? await resolveBundled(resolver, cwd) : await resolver.resolve({ cwd, session })

  if (resolution.status === 'ambiguous') {
    return {
      status: 'ambiguous',
      action,
      layer: resolution.layer,
      label: resolution.label,
      candidates: resolution.candidates.map((candidate, index) => ({
        index: index + 1,
        path: candidate.path,
        version: candidate.version ?? undefined,
        layer: resolution.layer,
      })),
      message: 'Several interpreters match this layer; pick one in the Custom Python settings.',
    }
  }
  if (resolution.status === 'missing') {
    return {
      status: 'missing',
      action,
      message: 'No Python interpreter was found. Pick one in the Custom Python settings.',
    }
  }

  let argv
  try {
    argv = buildArgv({ code: args.code, script: args.script, args: args.args })
  } catch (error) {
    return { status: 'error', action, interpreter: resolution.interpreter, message: String(error.message) }
  }

  const outcome = await runPython({
    interpreter: resolution.interpreter,
    argv,
    cwd,
    timeoutMs: settings.runTimeoutMs,
    signal: exec?.signal,
  })

  const base = {
    action,
    interpreter: resolution.interpreter,
    version: resolution.version ?? undefined,
    layer: resolution.layer,
    label: resolution.label,
    exit_code: outcome.exitCode ?? undefined,
    stdout: outcome.stdout || undefined,
    stderr: outcome.stderr || undefined,
    timed_out: outcome.timedOut || undefined,
  }

  if (outcome.exitCode === 0) return { status: 'ok', ...base }
  if (outcome.timedOut) return { status: 'timeout', ...base }

  const missing = missingModule(outcome.stderr)
  if (missing) {
    return {
      status: 'missing_module',
      ...base,
      missing_modules: [missing],
      fix: fixCommand(resolution.interpreter, missing),
    }
  }
  return { status: 'failed', ...base }
}

/**
 * Resolve the session's directory and identity from the services this profile provides.
 * Any missing piece degrades to the process directory rather than failing the call.
 * @param {any} ctx
 */
function resolveScope(ctx) {
  try {
    const agent = ctx.agents.currentInitiator()
    const cwd = ctx.workingDirectory.get(agent.session)
    return { cwd, sessionId: agent.session.id }
  } catch {
    return { cwd: process.cwd(), sessionId: 'process' }
  }
}

async function resolveBundled(resolver, cwd) {
  const layers = await resolver.inventory({ cwd })
  const bundledLayer = layers.find((layer) => layer.id === 'L7')
  const found = bundledLayer?.candidates.find((candidate) => candidate.version)
  if (!found) return { status: 'missing' }
  return {
    status: 'resolved',
    layer: 'L7',
    label: bundledLayer.label,
    interpreter: found.path,
    version: found.version,
  }
}

function flattenCandidates(layers) {
  const candidates = []
  for (const layer of layers) {
    for (const candidate of layer.candidates) {
      candidates.push({
        index: candidates.length + 1,
        path: candidate.path,
        version: candidate.version ?? undefined,
        layer: `${layer.id} ${layer.label}`,
        usable: candidate.version !== null,
      })
    }
  }
  return candidates
}

async function listAction({ resolver, cwd, sessionId, sessions, settings }) {
  const session = effectiveChoice(sessions, sessionId, settings, bundledInterpreterPath(settings))
  const layers = await resolver.inventory({ cwd, session })
  const candidates = flattenCandidates(layers).map(({ usable, ...rest }) => rest)
  return { status: 'ok', action: 'list', candidates }
}

async function statusAction({ resolver, cwd, sessionId, sessions, settings }) {
  const session = effectiveChoice(sessions, sessionId, settings, bundledInterpreterPath(settings))
  const resolution = await resolver.resolve({ cwd, session })
  if (resolution.status === 'resolved') {
    return {
      status: 'ok',
      action: 'status',
      interpreter: resolution.interpreter,
      version: resolution.version,
      layer: resolution.layer,
      label: resolution.label,
    }
  }
  return { status: resolution.status, action: 'status', layer: resolution.layer, label: resolution.label }
}

/**
 * Render the canonical value as the model-facing text. Kept terse on purpose: a failure is
 * three lines, not a traceback.
 * @param {any} value
 * @returns {string}
 */
export function renderText(value) {
  const lines = []
  if (value.action === 'list') {
    if (!value.candidates || value.candidates.length === 0) return 'No Python interpreter candidates found.'
    for (const candidate of value.candidates) {
      lines.push(`${candidate.index}. ${candidate.path}${candidate.version ? ` (${candidate.version})` : ' (unusable)'} - ${candidate.layer}`)
    }
    return lines.join('\n')
  }
  if (value.status === 'ok' && value.action === 'status') {
    return `${value.interpreter} (${value.version ?? 'unknown'}) - ${value.layer} ${value.label ?? ''}`.trim()
  }
  if (value.status === 'ok' && value.action === 'run') {
    if (value.stdout) lines.push(value.stdout.trimEnd())
    if (value.stderr) lines.push(value.stderr.trimEnd())
    lines.push(`[exit ${value.exit_code ?? 0}] ${value.interpreter} (${value.version ?? 'unknown'})`)
    return lines.join('\n')
  }
  if (value.status === 'missing_module') {
    lines.push(`Error: missing module '${value.missing_modules?.[0] ?? '?'}'`)
    lines.push(`interpreter: ${value.interpreter} (${value.version ?? 'unknown'})`)
    lines.push(`fix: ${value.fix}`)
    return lines.join('\n')
  }
  if (value.status === 'ambiguous') {
    lines.push(value.message ?? 'Ambiguous interpreter.')
    for (const candidate of value.candidates ?? []) lines.push(`${candidate.index}. ${candidate.path} (${candidate.version ?? 'unusable'})`)
    return lines.join('\n')
  }
  if (value.status === 'timeout') {
    lines.push(`Error: timed out${value.interpreter ? ` running ${value.interpreter}` : ''}`)
    if (value.stderr) lines.push(value.stderr.trimEnd())
    return lines.join('\n')
  }
  if (value.status === 'failed') {
    if (value.stderr) lines.push(value.stderr.trimEnd())
    else if (value.stdout) lines.push(value.stdout.trimEnd())
    lines.push(`[exit ${value.exit_code ?? 1}] ${value.interpreter} (${value.version ?? 'unknown'})`)
    return lines.join('\n')
  }
  return value.message ?? String(value.status)
}
