import { button } from './button.js'
import { h } from './element.js'
import { fileChip } from './file-chip.js'
import { icon } from './icon.js'

/**
 * The app's message pill (resources/views/components/ui/message-field.blade.php):
 * one line that grows, attachments above it, and a round send button inside it.
 * Like the app, memorize shows the send button once there is something to send
 * and the attach button until then; recall always shows it.
 */
export function composer({ label, placeholder, sendLabel, alwaysShowSend = false, onBrowse, onPasteFiles, onSubmit }) {
    let files = []
    let busy = false

    // On a touch keyboard Enter has to stay a newline: there is no Shift to fall back on.
    const sendsOnEnter = matchMedia('(hover: hover)').matches

    const chips = h('ul', { class: 'flex w-full flex-wrap gap-2 pt-2 pr-2 empty:hidden', 'aria-label': 'Attachments to add' })
    const textarea = h('textarea', {
        rows: 1,
        placeholder,
        'aria-label': label,
        class: 'field-text max-h-40 min-w-0 w-full flex-1 resize-none overflow-y-auto border-0 bg-transparent px-0 py-2.5 [field-sizing:content] focus:outline-none',
        onInput: refresh,
        onKeydown: (event) => {
            if (event.key === 'Enter' && (event.metaKey || (sendsOnEnter && !event.shiftKey))) {
                event.preventDefault()
                form.requestSubmit()
            }
        },
        onPaste: (event) => {
            if (onPasteFiles && event.clipboardData.files.length > 0) {
                event.preventDefault()
                onPasteFiles([...event.clipboardData.files])
            }
        },
    })

    const attach = onBrowse && button({ variant: 'quiet', shape: 'compact-icon', 'aria-label': 'Attach files', onClick: onBrowse }, icon('paperclip', 'size-5'))
    const send = button({ type: 'submit', shape: 'icon', 'aria-label': sendLabel }, icon('send-horizontal', 'size-5'))

    const form = h(
        'form',
        {
            class: 'field-frame flex flex-col gap-2 rounded-pill py-1.5 pr-1.5 pl-4',
            onSubmit: (event) => {
                event.preventDefault()

                if (!send.disabled && hasContent()) {
                    onSubmit({ files, text: textarea.value })
                }
            },
        },
        chips,
        h('div', { class: 'flex w-full items-end gap-1' }, textarea, attach, send),
    )

    function hasContent() {
        return files.length > 0 || textarea.value.trim() !== ''
    }

    function setFiles(changed) {
        files = changed
        chips.replaceChildren(...files.map((file) => fileChip({ file, onRemove: () => remove(file) })))
        refresh()
    }

    function refresh() {
        send.hidden = !alwaysShowSend && !hasContent()
        send.disabled = busy || !hasContent()

        if (attach) {
            attach.hidden = hasContent()
        }
    }

    function remove(file) {
        setFiles(files.filter((attached) => attached !== file))
        textarea.focus()
    }

    refresh()

    return {
        element: form,
        addFiles(added) {
            setFiles([...files, ...added])
        },
        addText(text) {
            textarea.value = [textarea.value, text].filter((part) => part !== '').join('\n')
            refresh()
        },
        reset() {
            textarea.value = ''
            setFiles([])
        },
        setBusy(isBusy) {
            busy = isBusy
            refresh()
        },
    }
}
