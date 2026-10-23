/**
 * Client half: one select, three seats.
 *
 * The settings page, the composer badge and the first-run prompt all render the same
 * `PythonSelect`, because the interaction is a single decision: which interpreter is the
 * default, or "关闭自定义 Python" to behave as if the plugin were not installed. Picking a
 * value takes effect immediately — there is no separate save, no per-session switch.
 */

window.__ModuleLoader__.load({
  id: 'dsh-custom-python',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useCallback, useEffect, useState } = React
    const ReactDOM = (() => {
      try {
        return require('react-dom')
      } catch {
        return null
      }
    })()

    const NS = 'customPython'

    const DICT = {
      en: {
        badgePrefix: 'py',
        title: 'Python environment',
        label: 'Default Python',
        hint: 'Takes effect immediately. Choose “关闭自定义 Python” to use the bundled runtime and hide this plugin’s tool.',
        apply: 'Apply',
        skip: 'Skip',
        onboardTitle: 'Choose a Python environment',
        onboardBody: 'Python calls can use your own interpreter instead of the bundled runtime. Pick one now; you can change it any time in settings.',
        loadFailed: 'Could not read the Python state.',
        retry: 'Retry',
      },
      zh: {
        badgePrefix: 'py',
        title: 'Python 环境',
        label: '默认 Python',
        hint: '选完立即生效。选“关闭自定义 Python”即回到内置 runtime，并让本插件的工具消失。',
        apply: '应用',
        skip: '跳过',
        onboardTitle: '选择一个 Python 环境',
        onboardBody: 'Python 调用可以走你自己的解释器，而不是内置 runtime。现在选一个，之后也能在设置里改。',
        loadFailed: '读不到 Python 状态。',
        retry: '重试',
      },
    }

    async function getState(sessionId) {
      try {
        const query = sessionId ? `?session=${encodeURIComponent(sessionId)}` : ''
        const response = await fetch(`/custom-python/state${query}`, { cache: 'no-store' })
        if (!response.ok) return null
        return await response.json()
      } catch {
        return null
      }
    }

    async function setValue(value) {
      try {
        const response = await fetch('/custom-python/setting', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ value }),
        })
        return await response.json()
      } catch {
        return null
      }
    }

    function useState_(sessionId) {
      const [state, setState] = useState(null)
      const [failed, setFailed] = useState(false)
      const reload = useCallback(() => {
        getState(sessionId).then((next) => {
          setFailed(next === null)
          if (next) setState(next)
        })
      }, [sessionId])
      useEffect(() => {
        reload()
      }, [reload])
      return { state, failed, reload }
    }

    const styles = {
      row: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
      label: { fontSize: 13, fontWeight: 600 },
      select: {
        font: 'inherit',
        fontSize: 13,
        padding: '5px 10px',
        borderRadius: 6,
        border: '1px solid rgba(127,127,127,0.45)',
        background: 'transparent',
        color: 'inherit',
        minWidth: 220,
        maxWidth: 420,
        cursor: 'pointer',
      },
      hint: { fontSize: 11, opacity: 0.6, marginTop: 8 },
      pill: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        height: 26,
        padding: '0 10px',
        borderRadius: 999,
        border: '1px solid currentColor',
        background: 'transparent',
        color: 'inherit',
        font: 'inherit',
        fontSize: 12,
        lineHeight: 1,
        cursor: 'pointer',
        opacity: 0.85,
        whiteSpace: 'nowrap',
      },
      panel: {
        width: 420,
        maxWidth: 'calc(100vw - 24px)',
        padding: 16,
        borderRadius: 12,
        border: '1px solid rgba(127,127,127,0.35)',
        background: 'var(--dsh-bg-elevated, Canvas)',
        color: 'CanvasText',
        boxShadow: '0 16px 48px rgba(0,0,0,0.35)',
        font: 'inherit',
        fontSize: 13,
      },
      action: {
        font: 'inherit',
        fontSize: 12,
        padding: '4px 10px',
        borderRadius: 6,
        border: '1px solid currentColor',
        background: 'transparent',
        color: 'inherit',
        cursor: 'pointer',
        opacity: 0.85,
      },
    }

    function Overlay({ children, onClose }) {
      useEffect(() => {
        const onKey = (event) => {
          if (event.key === 'Escape') onClose()
        }
        document.addEventListener('keydown', onKey)
        return () => document.removeEventListener('keydown', onKey)
      }, [onClose])

      const layer = h(
        'div',
        {
          style: { position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
          onMouseDown: (event) => {
            if (event.target === event.currentTarget) onClose()
          },
        },
        children,
      )
      return ReactDOM && ReactDOM.createPortal ? ReactDOM.createPortal(layer, document.body) : layer
    }

    /** The single interactive element this plugin owns. */
    function PythonSelect({ t, state, failed, onApply, reload }) {
      const [value, setValue] = useState(null)
      const current = value === null ? (state ? state.selected : '') : value
      const disabled = failed || !state

      return h(
        'div',
        null,
        h(
          'div',
          { style: styles.row },
          h('span', { style: styles.label }, t('label')),
          h(
            'select',
            {
              style: styles.select,
              value: current,
              disabled,
              onChange: (event) => {
                const next = event.target.value
                setValue(next)
                onApply(next)
              },
            },
            (state ? state.options : []).map((option) =>
              h('option', { key: option.value, value: option.value }, option.label),
            ),
          ),
        ),
        h('div', { style: styles.hint }, failed ? t('loadFailed') : t('hint')),
      )
    }

    function SettingsPage({ t }) {
      const { state, failed, reload } = useState_(undefined)
      return h(
        'div',
        { style: { padding: 16, fontSize: 13 } },
        h('h3', { style: { margin: '0 0 12px', fontSize: 15 } }, t('title')),
        h(PythonSelect, {
          t,
          state,
          failed,
          reload,
          onApply: async (value) => {
            await setValue(value)
            reload()
          },
        }),
      )
    }

    function Badge({ t, sessionId }) {
      const { state, failed, reload } = useState_(sessionId)
      const [open, setOpen] = useState(false)
      const label = state && state.resolution && state.resolution.label ? state.resolution.label.display : null
      const text = state && !state.enabled ? 'off' : label || '—'

      return h(
        'div',
        { style: { display: 'inline-flex' } },
        h(
          'button',
          { type: 'button', style: styles.pill, onClick: () => setOpen(true), title: t('title') },
          h('span', { style: { opacity: 0.6 } }, `${t('badgePrefix')}:`),
          h('span', null, text),
        ),
        open
          ? h(
              Overlay,
              { onClose: () => setOpen(false) },
              h(
                'div',
                { style: styles.panel },
                h(PythonSelect, {
                  t,
                  state,
                  failed,
                  reload,
                  onApply: async (value) => {
                    await setValue(value)
                    reload()
                    setOpen(false)
                  },
                }),
                h(
                  'div',
                  { style: { display: 'flex', justifyContent: 'flex-end', marginTop: 12 } },
                  h('button', { type: 'button', style: styles.action, onClick: () => setOpen(false) }, '✕'),
                ),
              ),
            )
          : null,
      )
    }

    function Onboarding({ t, sessionId }) {
      const { state, failed, reload } = useState_(sessionId)
      const [done, setDone] = useState(false)
      if (done || !state || !state.firstRun) return null
      return h(
        Overlay,
        { onClose: () => setDone(true) },
        h(
          'div',
          { style: styles.panel },
          h('div', { style: { fontWeight: 600, fontSize: 15, marginBottom: 6 } }, t('onboardTitle')),
          h('div', { style: { fontSize: 12, opacity: 0.75, marginBottom: 12 } }, t('onboardBody')),
          h(PythonSelect, {
            t,
            state,
            failed,
            reload,
            onApply: async (value) => {
              await setValue(value)
              setDone(true)
            },
          }),
          h(
            'div',
            { style: { display: 'flex', justifyContent: 'flex-end', marginTop: 12 } },
            h(
              'button',
              {
                type: 'button',
                style: styles.action,
                onClick: async () => {
                  await fetch('/custom-python/skip', { method: 'POST' }).catch(() => null)
                  setDone(true)
                },
              },
              t('skip'),
            ),
          ),
        ),
      )
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        // A re-apply (HMR, or a reloaded bundle) must not throw on the second registration.
        ctx.effect(() => {
          const disposers = []
          for (const [locale, dict] of Object.entries(DICT)) {
            try {
              disposers.push(ctx.locale.register(NS, locale, dict))
            } catch {
              /* stale registration from a crashed instance; text is identical */
            }
          }
          return () => {
            for (const dispose of disposers.splice(0)) {
              try {
                dispose()
              } catch {
                /* already released */
              }
            }
          }
        })

        const t = ctx.locale.bind(NS)

        const mount = (slot, options, component) => {
          ctx.slots.inject(slot, () => {
            try {
              return ctx.slots.register({ name: slot, ...options }, component)
            } catch {
              return undefined
            }
          })
        }

        mount('conversation.input.left', { id: 'custom-python-badge', order: 20 }, (props) =>
          h(Badge, { t, sessionId: props && props.sessionId }),
        )
        mount('settings.section', { id: 'custom-python', order: 45, label: () => t('title') }, () =>
          h(SettingsPage, { t }),
        )
        mount('shell.overlay', { id: 'custom-python-onboarding', order: 90 }, (props) =>
          h(Onboarding, { t, sessionId: props && props.sessionId }),
        )
      },
    }
  },
})
