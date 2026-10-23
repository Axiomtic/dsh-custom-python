/**
 * Client half: one dropdown, three seats.
 *
 * The control is a trigger plus a menu, not a modal: clicking the value shows the options
 * attached to it, opening upward inside the composer and downward where there is room. All
 * colors come from the Harness theme tokens, so it reads like the permission and model
 * pickers rather than like a plugin bolted on.
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
        label: 'Default Python',
        hint: 'Takes effect immediately. “关闭自定义 Python” restores the bundled runtime and removes this plugin’s tool.',
        skip: 'Skip',
        onboardTitle: 'Choose a Python environment',
        onboardBody: 'Python calls can use your own interpreter instead of the bundled runtime. Pick one now; you can change it any time in settings.',
        loadFailed: 'Could not read the Python state.',
        retry: 'Retry',
        off: 'Off — use bundled',
        current: 'current',
      },
      zh: {
        badgePrefix: 'py',
        title: 'Python 环境',
        label: '默认 Python',
        hint: '选完立即生效。“关闭自定义 Python”会回到内置 runtime，并让本插件的工具消失。',
        skip: '跳过',
        onboardTitle: '选择一个 Python 环境',
        onboardBody: 'Python 调用可以走你自己的解释器，而不是内置 runtime。现在选一个，之后也能在设置里改。',
        loadFailed: '读不到 Python 状态。',
        retry: '重试',
        off: '关闭 — 使用内置',
        current: '当前',
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
          body: JSON.stringify(body),
        })
        return await response.json()
      } catch {
        return null
      }
    }

    function setSetting(value) {
      return post('/custom-python/setting', { value })
    }

    /**
     * The active locale, used only on the fallback path; a missing service must not break rendering.
     * @param {any} ctx
     * @returns {string}
     */
    function safeActiveLocale(ctx) {
      try {
        return ctx.locale.getLocale().active
      } catch {
        return 'en'
      }
    }

    function setSession(sessionId, value) {
      return post('/custom-python/session', { session: sessionId, value })
    }

    function useSnapshot(sessionId) {
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

    /** Component-local styles: they unmount with the component. */
    function StyleSheet() {
      return h(
        'style',
        null,
        `
.dshcp-trigger {
  display: inline-flex; align-items: center; gap: 6px;
  height: 26px; padding: 0 8px; border-radius: 8px;
  border: 1px solid transparent; background: transparent;
  color: var(--dsw-alias-label-secondary);
  font: inherit; font-size: 12px; line-height: 1; white-space: nowrap; cursor: pointer;
}
.dshcp-trigger:hover { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-primary); }
.dshcp-trigger[data-open="true"] { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-primary); }
.dshcp-trigger--field {
  height: 32px; min-width: 240px; justify-content: space-between;
  border-color: var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
}
.dshcp-trigger--field:hover { border-color: var(--dsw-alias-border-l2); }
.dshcp-menu {
  position: fixed; z-index: 2000; min-width: 220px; max-height: 320px; overflow: auto;
  padding: 6px; border-radius: var(--dsw-radius-md, 12px);
  background: var(--dsw-alias-bg-overlay);
  border: 1px solid var(--dsw-alias-border-l1);
  box-shadow: 0 16px 40px rgba(0,0,0,0.32);
  color: var(--dsw-alias-label-primary);
  font-size: 13px;
}
.dshcp-item {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  width: 100%; padding: 8px 10px; border: 0; border-radius: var(--dsw-radius-sm, 8px);
  background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer;
}
.dshcp-item:hover { background: var(--dsw-alias-interactive-bg-hover); }
.dshcp-item[data-selected="true"] { color: var(--dsw-alias-brand-primary); background: var(--dsw-alias-interactive-bg-hover-solid); }
.dshcp-check { opacity: 0; font-size: 11px; }
.dshcp-item[data-selected="true"] .dshcp-check { opacity: 1; }
.dshcp-empty { padding: 8px 10px; color: var(--dsw-alias-label-secondary); font-size: 12px; }
.dshcp-hint { font-size: 11px; color: var(--dsw-alias-label-secondary); margin-top: 8px; }
.dshcp-panel {
  width: 420px; max-width: calc(100vw - 24px); padding: 16px; border-radius: 12px;
  background: var(--dsw-alias-bg-layer-1);
  border: 1px solid var(--dsw-alias-border-l1);
  color: var(--dsw-alias-label-primary); font-size: 13px;
  box-shadow: 0 16px 48px rgba(0,0,0,0.35);
}
`,
      )
    }

    function Chevron({ open }) {
      return h(
        'svg',
        { viewBox: '0 0 12 12', width: 10, height: 10, 'aria-hidden': true, style: { opacity: 0.7, transform: open ? 'rotate(180deg)' : 'none' } },
        h('path', { d: 'M2 4.5 6 8.5 10 4.5', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' }),
      )
    }

    /**
     * Trigger + menu. The menu is portalled so a clipping ancestor cannot hide it, and it
     * opens upward when the trigger sits low in the viewport (the composer case).
     */
    function Dropdown({ t, options, selected, failed, onApply, variant, prefix }) {
      const [open, setOpen] = useState(false)
      const [rect, setRect] = useState(null)
      const triggerRef = useRef(null)
      const menuRef = useRef(null)

      useEffect(() => {
        if (!open) return undefined
        const onKey = (event) => {
          if (event.key === 'Escape') setOpen(false)
        }
        const onDown = (event) => {
          if (menuRef.current && menuRef.current.contains(event.target)) return
          if (triggerRef.current && triggerRef.current.contains(event.target)) return
          setOpen(false)
        }
        document.addEventListener('keydown', onKey)
        document.addEventListener('mousedown', onDown)
        return () => {
          document.removeEventListener('keydown', onKey)
          document.removeEventListener('mousedown', onDown)
        }
      }, [open])

      const shown = options || []
      const current = shown.find((option) => option.value === selected)
      const display = current ? current.label : failed ? t('loadFailed') : '—'

      const toggle = () => {
        if (!triggerRef.current) return
        setRect(triggerRef.current.getBoundingClientRect())
        setOpen((value) => !value)
      }

      let menu = null
      if (open && rect) {
        const spaceBelow = window.innerHeight - rect.bottom
        const up = spaceBelow < 320 || rect.top > window.innerHeight * 0.55
        const width = Math.max(rect.width, 220)
        const left = Math.min(rect.left, window.innerWidth - width - 12)
        menu = h(
          'div',
          {
            ref: menuRef,
            className: 'dshcp-menu',
            style: {
              left: Math.max(8, left),
              width,
              ...(up ? { bottom: window.innerHeight - rect.top + 6 } : { top: rect.bottom + 6 }),
            },
            onMouseDown: (event) => event.stopPropagation(),
          },
          shown.length === 0
            ? h('div', { className: 'dshcp-empty' }, t('loadFailed'))
            : shown.map((option) =>
                h(
                  'button',
                  {
                    key: option.value,
                    type: 'button',
                    className: 'dshcp-item',
                    'data-selected': option.value === selected ? 'true' : 'false',
                    onClick: async () => {
                      setOpen(false)
                      if (option.value !== selected) await onApply(option.value)
                    },
                  },
                  h('span', null, option.label),
                  h('span', { className: 'dshcp-check' }, '✓'),
                ),
              ),
        )
      }

      return h(
        React.Fragment,
        null,
        h(
          'span',
          { style: { display: 'inline-flex' } },
          h(
            'button',
            {
              type: 'button',
              ref: triggerRef,
              className: variant === 'field' ? 'dshcp-trigger dshcp-trigger--field' : 'dshcp-trigger',
              'data-open': open ? 'true' : 'false',
              onClick: toggle,
              title: display,
              style: variant === 'field' ? undefined : { maxWidth: 240, overflow: 'hidden' },
            },
            prefix ? h('span', { style: { opacity: 0.55 } }, prefix) : null,
            h('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis' } }, display),
            h(Chevron, { open }),
          ),
        ),
        menu && (ReactDOM && ReactDOM.createPortal ? ReactDOM.createPortal(menu, document.body) : menu),
        h(StyleSheet, null),
      )
    }

    function SettingsPage({ t }) {
      const { state, failed, reload } = useSnapshot(undefined)
      return h(
        'div',
        { style: { padding: 16, fontSize: 13 } },
        h('h3', { style: { margin: '0 0 12px', fontSize: 15 } }, t('title')),
        h(
          'div',
          { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 } },
          h('span', { style: { fontSize: 13 } }, t('label')),
          h(Dropdown, {
            t,
            options: state ? state.global.options : [],
            selected: state ? state.global.selected : '',
            failed,
            variant: 'field',
            onApply: async (value) => {
              await setSetting(value)
              reload()
            },
          }),
        ),
        failed ? h('div', { className: 'dshcp-hint' }, t('loadFailed')) : null,
      )
    }

    function Badge({ t, sessionId }) {
      const { state, failed, reload } = useSnapshot(sessionId)
      // Disabled means "as if the plugin were not installed": no badge either.
      if (state && state.enabled === false) return null
      return h(Dropdown, {
        t,
        options: state ? state.session.options : [],
        selected: state ? state.session.selected : '',
        failed,
        prefix: `${t('badgePrefix')}:`,
        onApply: async (value) => {
          await setSession(sessionId, value)
          reload()
        },
      })
    }

    function Onboarding({ t, sessionId }) {
      const { state, failed, reload } = useSnapshot(sessionId)
      const [done, setDone] = useState(false)
      if (done || !state || !state.firstRun) return null
      return h(
        'div',
        {
          style: {
            position: 'fixed',
            inset: 0,
            zIndex: 90,
            background: 'rgba(0,0,0,0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          },
        },
        h(
          'div',
          { className: 'dshcp-panel' },
          h('div', { style: { fontWeight: 600, fontSize: 15, marginBottom: 6 } }, t('onboardTitle')),
          h('div', { style: { fontSize: 12, opacity: 0.75, marginBottom: 12 } }, t('onboardBody')),
          h(Dropdown, {
            t,
            options: state ? state.global.options : [],
            selected: state ? state.global.selected : '',
            failed,
            variant: 'field',
            onApply: async (value) => {
              await setSetting(value)
              setDone(true)
            },
          }),
          h(
            'div',
            { style: { display: 'flex', justifyContent: 'flex-end', marginTop: 14 } },
            h(
              'button',
              {
                type: 'button',
                className: 'dshcp-trigger dshcp-trigger--field',
                style: { minWidth: 0, height: 28, padding: '0 12px' },
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

        /**
         * The service returns the key itself when it cannot resolve one — and it can, in a page
         * that has been open across a code reload: a registration from the previous bundle
         * instance is still the occupant of this namespace, so keys added since then are
         * missing. Fall back to the dictionary shipped with *this* bundle rather than painting
         * a bare `label` into the settings page.
         * @param {string} key
         */
        const translate = (key) => {
          const value = t(key)
          if (value !== key) return value
          const active = safeActiveLocale(ctx)
          return DICT[active]?.[key] ?? DICT.en[key] ?? key
        }

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
          h(Badge, { t: translate, sessionId: props && props.sessionId }),
        )
        mount('settings.section', { id: 'custom-python', order: 45, label: () => translate('title') }, () =>
          h(SettingsPage, { t: translate }),
        )
        mount('shell.overlay', { id: 'custom-python-onboarding', order: 90 }, (props) =>
          h(Onboarding, { t: translate, sessionId: props && props.sessionId }),
        )
      },
    }
  },
})
