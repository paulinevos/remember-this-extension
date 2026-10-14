import { h } from './element.js'

/**
 * The variants and shapes of resources/views/components/ui/button.blade.php, so
 * a button here is the app's button. accent-outline is the extension's own: the
 * paste button when the clipboard holds something it can paste.
 */
const VARIANTS = {
    primary: 'bg-accent text-white hover:bg-accent/90 dark:bg-accent-dark dark:text-canvas-dark dark:hover:bg-accent-dark/90',
    secondary: 'border border-line-strong bg-surface text-ink hover:bg-canvas dark:border-line-strong-dark dark:bg-surface-dark dark:text-ink-dark dark:hover:bg-canvas-dark',
    quiet: 'text-muted hover:text-ink dark:text-muted-dark dark:hover:text-ink-dark',
    'accent-outline': 'border border-accent text-accent hover:bg-accent-wash dark:border-accent-dark dark:text-accent-dark dark:hover:bg-accent-wash-dark',
}

const SHAPES = {
    text: 'px-4',
    icon: 'size-11 shrink-0 rounded-full p-0 [&>svg]:shrink-0',
    'field-icon': 'size-9 min-h-0 shrink-0 rounded-full p-0 [&>svg]:shrink-0',
    'compact-icon': 'w-8 shrink-0 rounded-full p-0 [&>svg]:shrink-0',
}

export function buttonClasses({ variant = 'primary', shape = 'text', class: extra = '' } = {}) {
    return [
        'inline-flex min-h-(--size-touch) items-center justify-center rounded-control text-sm font-medium transition duration-200 active:scale-[0.98] disabled:opacity-60',
        VARIANTS[variant],
        SHAPES[shape],
        extra,
    ].join(' ')
}

export function button({ variant, shape, class: extra, ...attributes }, ...children) {
    return h('button', { type: 'button', ...attributes, class: buttonClasses({ variant, shape, class: extra }) }, ...children)
}
