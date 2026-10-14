import { appUrl } from '../browser.js'
import { buttonClasses } from './button.js'
import { h } from './element.js'
import { icon } from './icon.js'

/** The extension's name, as resources/views/components/ui/serif-wordmark.blade.php draws it. */
export function serifWordmark(className = '') {
    return h('span', { class: `font-display font-normal tracking-[-0.02em] ${className}` }, 'remember this')
}

/** The wordmark, then whatever the page puts beside it (the mode switch), then a link to the app. */
export function header(beside = null) {
    return h(
        'header',
        { class: 'flex items-center gap-2 border-b border-line-strong px-4 py-2 dark:border-line-strong-dark' },
        h('h1', { class: 'mr-auto whitespace-nowrap' }, serifWordmark(beside ? 'text-lg' : 'text-xl')),
        beside,
        h(
            'a',
            {
                href: appUrl,
                target: '_blank',
                rel: 'noopener',
                title: 'Open Remember This',
                'aria-label': 'Open Remember This',
                class: buttonClasses({ variant: 'quiet', shape: 'field-icon', class: '-mr-2' }),
            },
            icon('external-link', 'size-5'),
        ),
    )
}
