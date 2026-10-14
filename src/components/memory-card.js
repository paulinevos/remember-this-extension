import { button } from './button.js'
import { h } from './element.js'
import { icon } from './icon.js'

const DOCUMENT_FORMATS = {
    'application/pdf': ['PDF', 'pdf'],
    'text/markdown': ['Markdown', 'md'],
    'application/msword': ['Word', 'doc'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['Word', 'docx'],
}

/**
 * One recalled memory, as resources/views/components/ui/memory.blade.php shows
 * it: each note in its own bubble, then when it was remembered. Files arrive as
 * signed links that need the token, so loadMedia turns them into local URLs.
 */
export function memoryCard(memory, { loadMedia }) {
    return h(
        'article',
        { class: 'rise flex min-w-0 flex-col gap-1' },
        memory.notes.map((note, index) => h(
            'div',
            { class: 'bubble bg-surface shadow-paper dark:bg-surface-dark' },
            noteContent(note, memory.matches?.filter((match) => match.content_index === index) ?? [], loadMedia),
        )),
        h('p', { class: 'numeric mt-1 font-mono text-xs text-muted dark:text-muted-dark' }, `Remembered ${rememberedAgo(new Date(memory.remembered_at))}`),
    )
}

function noteContent(note, matches, loadMedia) {
    if (note.kind === 'image') {
        const image = h('img', { alt: 'A photo from this memory', class: 'max-h-56 w-full rounded-control bg-canvas object-contain dark:bg-canvas-dark' })
        loadMedia(note.url).then((url) => image.src = url, () => image.replaceWith(unavailable()))

        return image
    }

    if (note.kind === 'voice' && !note.url) {
        return h('p', { class: 'text-sm text-muted dark:text-muted-dark' }, 'This voice note is still being prepared.')
    }

    if (note.kind === 'voice') {
        const player = h('audio', { controls: true, preload: 'metadata', class: 'w-full', 'aria-label': 'A voice note from this memory' })
        loadMedia(note.url).then((url) => player.src = url, () => player.replaceWith(unavailable()))

        return player
    }

    if (note.kind === 'document') {
        const [format, extension] = DOCUMENT_FORMATS[note.format] ?? ['Document', 'bin']
        const pages = matches.map((match) => match.chunk_number).join(', ')

        return h(
            'div',
            { class: 'flex items-center gap-3' },
            h('span', { class: 'flex size-9 shrink-0 items-center justify-center rounded-control bg-accent-wash text-accent dark:bg-accent-wash-dark dark:text-accent-dark' }, icon('file', 'size-5')),
            h(
                'span',
                { class: 'min-w-0 flex-1 text-sm' },
                h('span', { class: 'block font-medium' }, `${format} document`),
                h('span', { class: 'block text-xs text-muted dark:text-muted-dark' }, pages === '' ? plural(note.units, 'page') : `Matched on page ${pages}`),
            ),
            button({
                variant: 'quiet',
                shape: 'field-icon',
                'aria-label': `Download the ${format} document`,
                onClick: async () => {
                    const link = h('a', { href: await loadMedia(note.url), download: `memory.${extension}` })
                    link.click()
                },
            }, icon('download')),
        )
    }

    return h('p', { class: 'text-sm/6 whitespace-pre-line' }, note.words)
}

function unavailable() {
    return h('p', { class: 'text-sm text-muted dark:text-muted-dark' }, 'This file could not be loaded.')
}

function plural(count, word) {
    return `${count} ${word}${count === 1 ? '' : 's'}`
}

/** "3 days ago" for the last month, the date after that, as the app does. */
function rememberedAgo(date) {
    const minutes = (Date.now() - date) / 60_000
    const relative = new Intl.RelativeTimeFormat('en', { numeric: 'always' })

    if (minutes < 1) {
        return 'just now'
    }

    if (minutes < 60) {
        return relative.format(-Math.round(minutes), 'minute')
    }

    if (minutes < 24 * 60) {
        return relative.format(-Math.round(minutes / 60), 'hour')
    }

    if (minutes < 30 * 24 * 60) {
        return relative.format(-Math.round(minutes / (24 * 60)), 'day')
    }

    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
