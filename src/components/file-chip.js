import { fieldFor } from '../memories.js'
import { button } from './button.js'
import { h } from './element.js'
import { icon } from './icon.js'

const previews = new WeakMap()

/** An attachment waiting in the message pill, drawn as the app's composer draws one. */
export function fileChip({ file, onRemove }) {
    const field = fieldFor(file)

    if (field === 'image' && !previews.has(file)) {
        previews.set(file, URL.createObjectURL(file))
    }

    const preview = previews.get(file)

    return h(
        'li',
        { class: 'flex min-w-0 max-w-full items-center gap-3 rounded-2xl border border-line px-3 py-2 dark:border-line-dark' },
        preview
            ? h('img', { src: preview, alt: 'Photo to add', class: 'size-10 shrink-0 rounded-lg object-cover' })
            : icon(field === 'voice' ? 'audio-lines' : 'file', 'size-7 shrink-0 text-muted dark:text-muted-dark'),
        h(
            'span',
            { class: 'min-w-0' },
            h('span', { class: 'block truncate text-sm' }, file.name),
            h('span', { class: 'block text-xs text-muted dark:text-muted-dark' }, details(file)),
        ),
        button({
            variant: 'quiet',
            shape: 'icon',
            class: 'shrink-0',
            'aria-label': `Remove ${file.name}`,
            onClick: () => {
                if (preview) {
                    URL.revokeObjectURL(preview)
                    previews.delete(file)
                }

                onRemove()
            },
        }, icon('x')),
    )
}

/** "PDF · 248 KiB", as the app's composer labels an attachment. */
function details(file) {
    const type = file.name.split('.').pop().toUpperCase()
    const size = file.size >= 1024 * 1024 ? `${(file.size / 1024 / 1024).toFixed(1)} MiB` : `${Math.max(1, Math.round(file.size / 1024))} KiB`

    return `${type} · ${size}`
}
