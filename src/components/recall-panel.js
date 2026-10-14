import { SignedOut } from '../connection.js'
import { mediaUrl, recall } from '../memories.js'
import { composer } from './composer.js'
import { h } from './element.js'
import { memoryCard } from './memory-card.js'
import { note } from './note.js'

/**
 * Recall mode: the app's Remind me screen in miniature. Results sit above the
 * question field, as in the app, and stay until the next question.
 */
export function recallPanel({ onSignedOut }) {
    let loaded = []

    const results = h('div', { class: 'flex max-h-96 flex-col gap-3 overflow-y-auto overscroll-contain [scrollbar-width:thin] empty:hidden', 'aria-live': 'polite' })

    const question = composer({
        label: 'Search your memories',
        placeholder: 'What did I say about…',
        sendLabel: 'Remind me',
        alwaysShowSend: true,
        onSubmit: async ({ text }) => {
            question.setBusy(true)
            loaded.forEach((url) => URL.revokeObjectURL(url))
            loaded = []
            results.replaceChildren(h('span', { class: 'sr-only' }, 'Looking through your memories'), ...[70, 88, 55].map(skeleton))

            try {
                const memories = await recall(text.trim())

                results.replaceChildren(...(memories.length > 0
                    ? memories.map((memory) => memoryCard(memory, { loadMedia }))
                    : [hint('Nothing came up for that. Try describing it another way, or give it a moment if you just saved it.')]))
            } catch (failure) {
                if (failure instanceof SignedOut) {
                    return onSignedOut()
                }

                results.replaceChildren(note(failure instanceof TypeError ? 'We could not reach Remember This. Check your connection and try again.' : failure.message, 'error'))
            } finally {
                question.setBusy(false)
            }
        },
    })

    async function loadMedia(signedUrl) {
        const url = await mediaUrl(signedUrl)
        loaded.push(url)

        return url
    }

    return h('div', { class: 'flex flex-col gap-4 p-4' }, results, question.element)
}

/** resources/views/components/ui/note.blade.php's hint. */
function hint(text) {
    return h('p', { class: 'body-copy mx-auto max-w-sm border-t border-accent/40 pt-4 text-center text-muted dark:text-muted-dark' }, text)
}

/** resources/views/components/ui/skeleton.blade.php: shaped like a memory so nothing jumps. */
function skeleton(width, index) {
    return h(
        'div',
        { class: 'bubble bg-canvas p-0! dark:bg-canvas-dark', style: `width: ${width}%`, 'aria-hidden': 'true' },
        h(
            'div',
            { class: 'breathe rounded-[inherit] bg-ink/6 px-4 py-3 dark:bg-ink-dark/6', style: `animation-delay: ${index * 140}ms` },
            h('div', { class: 'h-2.5 rounded-full bg-ink/10 dark:bg-ink-dark/10' }),
            h('div', { class: 'mt-2 h-2.5 w-2/3 rounded-full bg-ink/10 dark:bg-ink-dark/10' }),
        ),
    )
}
