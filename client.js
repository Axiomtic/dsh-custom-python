/**
 * Client half: the composer badge, the settings page, and the first-run prompt.
 *
 * Everything that reads the filesystem or resolves an interpreter stays on the Host; this
 * module only renders `/custom-python/*` snapshots and posts user actions back.
 */

window.__ModuleLoader__.load({
  id: 'dsh-custom-python',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useCallback, useEffect, useState } = React

    const NS = 'customPython'

    const DICT = {
      en: {
        badgePrefix: 'py',
        builtin: 'bundled',
        title: 'Python environment',
        current: 'In use',
        use: 'Use',
        useForSession: 'Use for this session',
        setDefault: 'Set as default',
        clearDefault: 'Clear default',
        defaultLabel: 'Global default',
        none: 'No default — the resolver picks automatically',
        skip: 'Skip',
        onboardTitle: 'Choose a default Python',
        onboardBody: 'This plugin can route Python calls to your own interpreter instead of the bundled runtime. Pick a default now, or skip and choose later.',
        noCandidates: 'No interpreter found yet.',
        unusable: 'cannot start',
        saved: 'Saved',
        confirm: 'OK',
      },
      zh: {
        badgePrefix: 'py',
        builtin: '内置',
        title: 'Python 环境',
        current: '当前使用',
        use: '使用',
        useForSession: '本会话使用',
        setDefault: '设为默认',
        clearDefault: '清除默认',
        defaultLabel: '全局默认',
        none: '未设置默认，由解析器自动选择',
        skip: '跳过',
        onboardTitle: '选择一个默认 Python',
        onboardBody: '这个插件可以让 Python 调用走你自己的解释器，而不是内置 runtime。现在选一个默认值，或者跳过以后再设。',
        noCandidates: '还没有发现解释器。',
        unusable: '无法启动',
        saved: '已保存',
        confirm: '好',
      },
    }

    async function getState() {
      try {
        const response = await fetch('/custom-python/state', { cache: 'no-store' })
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
        return await response.json()
      } catch {
        return null
      }
    }

    function useSnapshot(poll) {
      const [state, setState] = useState(null)
      const reload = useCallback(() => {
        getState().then((next) => next && setState(next))
      }, [])
      useEffect(() => {
        reload()
        if (!poll) return undefined
        const timer = setInterval(reload, 15000)
        return () => clearInterval(timer)
      }, [poll, reload])
      return [state, reload]
    }

    function labelFor(state, t) {
      if (!state || !state.resolution) return t('builtin')
      if (state.resolution.status !== 'resolved') return t('builtin')
      const interpreter = state.resolution.interpreter ?? ''
      const base = interpreter.split(/[\\/]/).filter(Boolean)
      const name = base.length >= 2 ? base[base.length - 2] : base[base.length - 1] || interpreter
      return `${name} ${state.resolution.version ?? ''}`.trim()
    }

    const pill = {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      height: 28,
      padding: '0 10px',
      borderRadius: 999,
      border: '1px solid currentColor',
      background: 'transparent',
      color: 'inherit',
      font: 'inherit',
      fontSize: 12,
      cursor: 'pointer',
      opacity: 0.85,
    }

    const card = {
      position: 'fixed',
      zIndex: 60,
      width: 420,
      maxWidth: 'calc(100vw - 32px)',
      maxHeight: '70vh',
      overflow: 'auto',
      padding: 16,
      borderRadius: 12,
      border: '1px solid rgba(127,127,127,0.35)',
      background: 'var(--dsh-bg-elevated, Canvas)',
      color: 'inherit',
      boxShadow: '0 12px 40px rgba(0,0,0,0.35)',
      font: 'inherit',
      fontSize: 13,
    }

    const rowStyle = {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '8px 6px',
      borderRadius: 8,
    }

    const buttonStyle = {
      font: 'inherit',
      fontSize: 12,
      padding: '4px 10px',
      borderRadius: 6,
      border: '1px solid currentColor',
      background: 'transparent',
      color: 'inherit',
      cursor: 'pointer',
      opacity: 0.9,
    }

    function CandidateList({ state, t, onUse, onDefault, session }) {
      if (!state) return h('div', { style: { opacity: 0.7 } }, '…')
      const candidates = state.candidates ?? []
      if (candidates.length === 0) return h('div', { style: { opacity: 0.7 } }, t('noCandidates'))
      const current = state.resolution && state.resolution.status === 'resolved' ? state.resolution.interpreter : null
      return h(
        'div',
        null,
        candidates.map((candidate, index) =>
          h(
            'div',
            { key: `${candidate.path}-${index}`, style: { ...rowStyle, opacity: candidate.usable ? 1 : 0.5 } },
            h(
              'div',
              { style: { flex: 1, minWidth: 0 } },
              h('div', { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, candidate.path),
              h(
                'div',
                { style: { fontSize: 11, opacity: 0.65 } },
                `${candidate.version ?? t('unusable')} · ${candidate.layer}`,
              ),
            ),
            candidate.path === current ? h('span', { style: { fontSize: 11, opacity: 0.7 } }, t('current')) : null,
            candidate.usable
              ? h('button', { type: 'button', style: buttonStyle, onClick: () => onUse(candidate.path, session) }, t('use'))
              : null,
            candidate.usable
              ? h('button', { type: 'button', style: buttonStyle, onClick: () => onDefault(candidate.path) }, t('setDefault'))
              : null,
          ),
        ),
      )
    }

    function Badge({ t }) {
      const [state, reload] = useSnapshot(true)
      const [open, setOpen] = useState(false)
      const onUse = useCallback(
        async (path, session) => {
          await post('/custom-python/use', { interpreter: path, session })
          setOpen(false)
          reload()
        },
        [reload],
      )
      const onDefault = useCallback(
        async (path) => {
          await post('/custom-python/default', { interpreter: path })
          reload()
        },
        [reload],
      )
      return h(
        'div',
        { style: { position: 'relative', display: 'inline-flex' } },
        h(
          'button',
          { type: 'button', style: pill, title: state?.resolution?.interpreter ?? '', onClick: () => setOpen((value) => !value) },
          h('span', { style: { opacity: 0.6 } }, `${t('badgePrefix')}:`),
          h('span', null, labelFor(state, t)),
        ),
        open
          ? h(
              'div',
              { style: { ...card, bottom: 'calc(100% + 8px)', left: 0 } },
              h('div', { style: { fontWeight: 600, marginBottom: 8 } }, t('title')),
              h(CandidateList, { state, t, onUse, onDefault, session: state?.session }),
              h(
                'div',
                { style: { marginTop: 10, fontSize: 11, opacity: 0.7 } },
                state?.defaultInterpreter ? `${t('defaultLabel')}: ${state.defaultInterpreter}` : t('none'),
              ),
            )
          : null,
      )
    }

    function SettingsPage({ t }) {
      const [state, reload] = useSnapshot(false)
      const onUse = useCallback(
        async (path, session) => {
          await post('/custom-python/use', { interpreter: path, session })
          reload()
        },
        [reload],
      )
      const onDefault = useCallback(
        async (path) => {
          await post('/custom-python/default', { interpreter: path })
          reload()
        },
        [reload],
      )
      const clearDefault = useCallback(async () => {
        await post('/custom-python/default', { interpreter: null })
        reload()
      }, [reload])
      return h(
        'div',
        { style: { padding: 16, fontSize: 13 } },
        h('h3', { style: { margin: '0 0 6px', fontSize: 15 } }, t('title')),
        h('div', { style: { opacity: 0.75, marginBottom: 12 } }, state?.defaultInterpreter ? `${t('defaultLabel')}: ${state.defaultInterpreter}` : t('none')),
        h(CandidateList, { state, t, onUse, onDefault, session: state?.session }),
        h(
          'div',
          { style: { marginTop: 12 } },
          h('button', { type: 'button', style: buttonStyle, onClick: clearDefault }, t('clearDefault')),
        ),
      )
    }

    function Onboarding({ t }) {
      const [state, reload] = useSnapshot(false)
      const [dismissed, setDismissed] = useState(false)
      if (dismissed || !state || !state.firstRun) return null
      const skip = async () => {
        await post('/custom-python/skip', {})
        setDismissed(true)
      }
      const choose = async (path) => {
        await post('/custom-python/default', { interpreter: path })
        setDismissed(true)
      }
      return h(
        'div',
        { style: { position: 'fixed', inset: 0, zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)' } },
        h(
          'div',
          { style: card },
          h('div', { style: { fontWeight: 600, fontSize: 15, marginBottom: 6 } }, t('onboardTitle')),
          h('div', { style: { opacity: 0.8, marginBottom: 12 } }, t('onboardBody')),
          h(CandidateList, { state, t, onUse: (path) => choose(path), onDefault: (path) => choose(path), session: state.session }),
          h(
            'div',
            { style: { display: 'flex', justifyContent: 'flex-end', marginTop: 12 } },
            h('button', { type: 'button', style: buttonStyle, onClick: skip }, t('skip')),
          ),
        ),
      )
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.locale.register(NS, 'en', DICT.en)
        ctx.locale.register(NS, 'zh', DICT.zh)
        const t = ctx.locale.bind(NS)

        ctx.slots.inject('conversation.input.left', () =>
          ctx.slots.register({ name: 'conversation.input.left', id: 'custom-python-badge', order: 20 }, () => h(Badge, { t })),
        )
        ctx.slots.inject('settings.section', () =>
          ctx.slots.register({ name: 'settings.section', id: 'custom-python', order: 45, label: () => t('title') }, () => h(SettingsPage, { t })),
        )
        ctx.slots.inject('shell.overlay', () =>
          ctx.slots.register({ name: 'shell.overlay', id: 'custom-python-onboarding', order: 90 }, () => h(Onboarding, { t })),
        )
      },
    }
  },
})
