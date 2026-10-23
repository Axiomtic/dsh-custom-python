/**
 * Client half: the composer badge, the settings page, and the first-run prompt.
 *
 * Everything that reads the filesystem or resolves an interpreter stays on the Host; this
 * module only renders `/custom-python/*` snapshots and posts user actions back.
 *
 * Two rendering constraints shaped this file:
 * - the composer row clips overflow, so the picker is rendered through a portal on `body`
 *   (falling back to fixed positioning when `react-dom` is not in the module table);
 * - the slot supplies the real `sessionId`, so a switch made here applies to the same
 *   session the tool resolves for.
 */

window.__ModuleLoader__.load({
  id: 'dsh-custom-python',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useCallback, useEffect, useRef, useState } = React
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
        current: 'current',
        use: 'Use here',
        setDefault: 'Make default',
        clearDefault: 'Clear default',
        defaultLabel: 'Default',
        none: 'No default yet',
        skip: 'Skip',
        onboardTitle: 'Choose a default Python',
        onboardBody: 'Route Python calls to your own interpreter instead of the bundled runtime. Pick one now, or skip and choose later in settings.',
        noCandidates: 'No interpreter found yet.',
        unusable: 'cannot start',
        loadFailed: 'Could not read the Python state. Retry.',
        retry: 'Retry',
        refreshing: 'Refreshing…',
      },
      zh: {
        badgePrefix: 'py',
        title: 'Python 环境',
        current: '当前',
        use: '本会话使用',
        setDefault: '设为默认',
        clearDefault: '清除默认',
        defaultLabel: '默认',
        none: '尚未设置默认',
        skip: '跳过',
        onboardTitle: '选择一个默认 Python',
        onboardBody: '让 Python 调用走你自己的解释器，而不是内置 runtime。现在选一个，或者跳过、之后在设置里选。',
        noCandidates: '还没有发现解释器。',
        unusable: '无法启动',
        loadFailed: '读不到 Python 状态，重试一次。',
        retry: '重试',
        refreshing: '刷新中…',
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

    async function post(path, body) {
      try {
        const response = await fetch(path, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body ?? {}),
        })
        const payload = await response.json().catch(() => null)
        return { ok: response.ok, payload }
      } catch (error) {
        return { ok: false, payload: { error: String(error && error.message ? error.message : error) } }
      }
    }

    function useSnapshot(sessionId, poll) {
      const [state, setState] = useState(null)
      const [failed, setFailed] = useState(false)
      const [busy, setBusy] = useState(false)
      const reload = useCallback(() => {
        setBusy(true)
        getState(sessionId)
          .then((next) => {
            setFailed(next === null)
            if (next) setState(next)
          })
          .finally(() => setBusy(false))
      }, [sessionId])

      useEffect(() => {
        reload()
        if (!poll) return undefined
        const timer = setInterval(reload, 15000)
        return () => clearInterval(timer)
      }, [poll, reload])

      return { state, failed, busy, reload }
    }

    const styles = {
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
        width: 460,
        maxWidth: 'calc(100vw - 24px)',
        maxHeight: '60vh',
        overflow: 'auto',
        padding: 14,
        borderRadius: 12,
        border: '1px solid rgba(127,127,127,0.35)',
        background: 'var(--dsh-bg-elevated, Canvas)',
        color: 'CanvasText',
        boxShadow: '0 16px 48px rgba(0,0,0,0.35)',
        font: 'inherit',
        fontSize: 13,
      },
      row: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '9px 10px',
        borderRadius: 8,
        border: '1px solid transparent',
      },
      rowButton: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '9px 10px',
        borderRadius: 8,
        border: '1px solid rgba(127,127,127,0.25)',
        background: 'transparent',
        color: 'inherit',
        font: 'inherit',
        fontSize: 13,
        textAlign: 'left',
        width: '100%',
        cursor: 'pointer',
      },
      name: { fontWeight: 600 },
      meta: { fontSize: 11, opacity: 0.65 },
      action: {
        font: 'inherit',
        fontSize: 11,
        padding: '3px 8px',
        borderRadius: 6,
        border: '1px solid currentColor',
        background: 'transparent',
        color: 'inherit',
        cursor: 'pointer',
        opacity: 0.85,
        whiteSpace: 'nowrap',
      },
      error: { color: '#e06c75', fontSize: 12, marginBottom: 8 },
    }

    /** Render into `document.body` so a clipping ancestor cannot hide the panel. */
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
          style: { position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(0,0,0,0.35)' },
          onMouseDown: (event) => {
            if (event.target === event.currentTarget) onClose()
          },
        },
        h('div', { style: { position: 'absolute', left: 24, top: 80 } }, children),
      )

      return ReactDOM && ReactDOM.createPortal ? ReactDOM.createPortal(layer, document.body) : layer
    }

    function candidatesOf(state) {
      return (state && state.candidates) || []
    }

    function CandidateRow({ candidate, t, current, onDefault, onUse }) {
      const meta = [candidate.kind, candidate.layer].filter(Boolean).join(' · ')
      return h(
        'div',
        { style: { ...styles.row, justifyContent: 'space-between', opacity: candidate.usable ? 1 : 0.5 } },
        h(
          'div',
          { style: { flex: 1, minWidth: 0 }, title: candidate.path },
          h('div', { style: styles.name }, candidate.display || candidate.path),
          h('div', { style: styles.meta }, candidate.usable ? meta : `${meta} · ${t('unusable')}`),
        ),
        candidate.path === current ? h('span', { style: styles.meta }, t('current')) : null,
        candidate.usable
          ? h('button', { type: 'button', style: styles.action, onClick: () => onDefault(candidate.path) }, t('setDefault'))
          : null,
        candidate.usable
          ? h('button', { type: 'button', style: styles.action, onClick: () => onUse(candidate.path) }, t('use'))
          : null,
      )
    }

    function Panel({ t, state, failed, busy, reload, sessionId, onClose, mode }) {
      const [notice, setNotice] = useState(null)
      const onDefault = useCallback(
        async (path) => {
          const result = await post('/custom-python/default', { interpreter: path })
          if (!result.ok) return setNotice(result.payload?.error || t('loadFailed'))
          setNotice(null)
          reload()
        },
        [reload, t],
      )
      const onUse = useCallback(
        async (path) => {
          const result = await post('/custom-python/use', { interpreter: path, session: sessionId })
          if (!result.ok) return setNotice(result.payload?.error || t('loadFailed'))
          setNotice(null)
          reload()
          if (mode === 'onboarding') onClose()
        },
        [onClose, mode, reload, sessionId, t],
      )
      const current = state && state.resolution && state.resolution.status === 'resolved' ? state.resolution.interpreter : null
      const candidates = candidatesOf(state)

      return h(
        'div',
        { style: styles.panel },
        h('div', { style: { fontWeight: 600, marginBottom: 4 } }, mode === 'onboarding' ? t('onboardTitle') : t('title')),
        mode === 'onboarding' ? h('div', { style: { ...styles.meta, marginBottom: 10 } }, t('onboardBody')) : null,
        h(
          'div',
          { style: { ...styles.meta, marginBottom: 10 } },
          state && state.defaultDisplay ? `${t('defaultLabel')}: ${state.defaultDisplay}` : t('none'),
        ),
        failed ? h('div', { style: styles.error }, t('loadFailed')) : null,
        notice ? h('div', { style: styles.error }, notice) : null,
        candidates.length === 0 ? h('div', { style: styles.meta }, t('noCandidates')) : null,
        candidates.map((candidate, index) =>
          h(CandidateRow, {
            key: `${candidate.path}-${index}`,
            candidate,
            t,
            current,
            onDefault,
            onUse,
          }),
        ),
        h(
          'div',
          { style: { display: 'flex', gap: 8, justifyContent: 'space-between', marginTop: 12 } },
          h('button', { type: 'button', style: styles.action, onClick: reload, disabled: busy }, busy ? t('refreshing') : t('retry')),
          h(
            'div',
            { style: { display: 'flex', gap: 8 } },
            state && state.defaultInterpreter
              ? h(
                  'button',
                  {
                    type: 'button',
                    style: styles.action,
                    onClick: async () => {
                      await post('/custom-python/default', { interpreter: null })
                      reload()
                    },
                  },
                  t('clearDefault'),
                )
              : null,
            h('button', { type: 'button', style: styles.action, onClick: onClose }, mode === 'onboarding' ? t('skip') : '✕'),
          ),
        ),
      )
    }

    function Badge(props) {
      const t = props.t
      const sessionId = props.sessionId
      const { state, failed, busy, reload } = useSnapshot(sessionId, true)
      const [open, setOpen] = useState(false)
      const label = state && state.resolution ? state.resolution.label : null
      const text = label && label.display ? label.display : state && state.resolution && state.resolution.version ? state.resolution.version : '—'

      return h(
        'div',
        { style: { display: 'inline-flex' } },
        h(
          'button',
          {
            type: 'button',
            style: styles.pill,
            title: state && state.resolution ? state.resolution.interpreter || '' : '',
            onClick: () => setOpen(true),
          },
          h('span', { style: { opacity: 0.6 } }, `${t('badgePrefix')}:`),
          h('span', null, text),
        ),
        open
          ? h(
              Overlay,
              { onClose: () => setOpen(false) },
              h(Panel, { t, state, failed, busy, reload, sessionId, mode: 'picker', onClose: () => setOpen(false) }),
            )
          : null,
      )
    }

    function SettingsPage(props) {
      const t = props.t
      const { state, failed, busy, reload } = useSnapshot(undefined, false)
      const [open, setOpen] = useState(false)
      const candidates = candidatesOf(state)
      const current = state && state.resolution && state.resolution.status === 'resolved' ? state.resolution.interpreter : null

      return h(
        'div',
        { style: { padding: 16, fontSize: 13 } },
        h('div', { style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 } }, h('h3', { style: { margin: 0, fontSize: 15 } }, t('title'))),
        h(
          'div',
          { style: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 } },
          h('span', { style: { fontSize: 13 } }, state && state.defaultDisplay ? `${t('defaultLabel')}: ${state.defaultDisplay}` : t('none')),
          h('button', { type: 'button', style: styles.action, onClick: () => setOpen(true) }, t('setDefault')),
        ),
        failed ? h('div', { style: styles.error }, t('loadFailed')) : null,
        candidates.length === 0
          ? h('div', { style: styles.meta }, t('noCandidates'))
          : candidates.map((candidate, index) =>
              h(CandidateRow, {
                key: `${candidate.path}-${index}`,
                candidate,
                t,
                current,
                onDefault: async (path) => {
                  await post('/custom-python/default', { interpreter: path })
                  reload()
                },
                onUse: async (path) => {
                  await post('/custom-python/use', { interpreter: path })
                  reload()
                },
              }),
            ),
        open
          ? h(
              Overlay,
              { onClose: () => setOpen(false) },
              h(Panel, { t, state, failed, busy, reload, sessionId: undefined, mode: 'picker', onClose: () => setOpen(false) }),
            )
          : null,
      )
    }

    function Onboarding(props) {
      const t = props.t
      const { state, failed, busy, reload } = useSnapshot(props.sessionId, false)
      const [done, setDone] = useState(false)
      if (done || !state || !state.firstRun) return null
      return h(
        Overlay,
        { onClose: () => setDone(true) },
        h(Panel, { t, state, failed, busy, reload, sessionId: props.sessionId, mode: 'onboarding', onClose: () => setDone(true) }),
      )
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        // A re-apply (HMR, or a reloaded bundle) must not throw on the second registration:
        // namespace dictionaries are single-occupant. Keep the disposers and tolerate a
        // namespace that a previous instance failed to release.
        ctx.effect(() => {
          const disposers = []
          for (const [locale, dict] of Object.entries(DICT)) {
            try {
              disposers.push(ctx.locale.register(NS, locale, dict))
            } catch {
              /* a stale registration from a crashed instance; text is identical */
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
