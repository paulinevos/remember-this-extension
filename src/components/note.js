import { h } from './element.js'
import { icon } from './icon.js'

/** The app's inline status and error lines, as its screens write them. */
export function note(text, tone = 'status') {
    return h(
        'p',
        {
            role: tone === 'error' ? 'alert' : 'status',
            class: tone === 'error'
                ? 'border-l-2 border-danger/60 pl-3 text-sm text-danger dark:border-danger-dark/60 dark:text-danger-dark'
                : 'border-l-2 border-accent/60 pl-3 text-sm text-muted dark:border-accent-dark/60 dark:text-muted-dark',
        },
        text,
    )
}

/** The transient confirmation shown once after logging in. */
export function connectedNotice() {
    const notice = h(
        'p',
        { role: 'status', class: 'rise flex items-center gap-2 text-sm font-medium text-accent dark:text-accent-dark' },
        h(
            'span',
            { class: 'flex size-5 items-center justify-center rounded-full bg-accent text-white dark:bg-accent-dark dark:text-canvas-dark' },
            icon('check', 'size-3.5 stroke-3'),
        ),
        'Connected',
    )

    setTimeout(() => notice.remove(), 4000)

    return notice
}
