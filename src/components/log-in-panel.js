import { button } from './button.js'
import { h } from './element.js'
import { icon } from './icon.js'
import { note } from './note.js'

export function logInPanel({ onLogIn }) {
    const problem = h('div', { class: 'empty:hidden' })
    const logIn = button(
        {
            class: 'min-h-12 gap-2.5 px-8 text-base font-semibold',
            onClick: async () => {
                logIn.disabled = true
                problem.replaceChildren()

                try {
                    await onLogIn()
                } catch (failure) {
                    problem.replaceChildren(note(failure.message, 'error'))
                    logIn.disabled = false
                }
            },
        },
        'Log in',
        icon('external-link', 'size-5'),
    )

    return h(
        'section',
        { class: 'flex min-h-60 flex-col items-center justify-center gap-3 p-6' },
        logIn,
        h('p', { class: 'text-sm text-muted dark:text-muted-dark' }, 'Opens in your browser'),
        problem,
    )
}
