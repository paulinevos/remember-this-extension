import { extension } from './browser.js'
import { startScreenshot, takeStaged, whenStaged } from './capture.js'
import { clipboardHasSomethingToPaste, readClipboard } from './clipboard.js'
import { button } from './components/button.js'
import { composer } from './components/composer.js'
import { dropZone } from './components/drop-zone.js'
import { h } from './components/element.js'
import { icon } from './components/icon.js'
import { logInPanel } from './components/log-in-panel.js'
import { modeSwitch } from './components/mode-switch.js'
import { connectedNotice, note } from './components/note.js'
import { pasteButton } from './components/paste-button.js'
import { recallPanel } from './components/recall-panel.js'
import { authorizedFetch, beginLogIn, currentSession, SignedOut, takeJustConnected } from './connection.js'
import { acceptedFiles, fieldFor, remember } from './memories.js'
import { page } from './page.js'

const inTab = new URLSearchParams(location.search).has('tab')
const { show, showWith } = page({ inTab })

start()

async function start() {
    if (!await currentSession()) {
        return showLogIn()
    }

    showReady({
        connected: await takeJustConnected(),
        pickerNeedsTab: await pickerNeedsTab(),
        mode: (await extension.storage.local.get('mode')).mode ?? 'remember-this',
        staged: await takeStaged(),
    })

    // Disconnecting from account settings should show here the next time, not
    // only once something fails to save.
    authorizedFetch('/api/documents/allowance').catch((failure) => {
        if (failure instanceof SignedOut) {
            showLogIn()
        }
    })
}

function showLogIn() {
    show(logInPanel({
        onLogIn: async () => {
            await beginLogIn()
            window.close()
        },
    }))
}

function showReady({ connected, pickerNeedsTab, mode, staged }) {
    const status = h('div', { 'aria-live': 'polite', class: 'empty:hidden' })
    const say = (text, tone) => status.replaceChildren(note(text, tone))

    const picker = h('input', {
        type: 'file',
        multiple: true,
        accept: acceptedFiles,
        class: 'hidden',
        onChange: () => {
            attach([...picker.files])
            picker.value = ''
        },
    })

    const browse = () => {
        if (!pickerNeedsTab) {
            return picker.click()
        }

        extension.tabs.create({ url: extension.runtime.getURL('popup.html?tab') })
        window.close()
    }

    const message = composer({
        label: 'Something worth remembering',
        placeholder: 'Write a message…',
        sendLabel: 'Remember',
        onBrowse: browse,
        onPasteFiles: attach,
        onSubmit: save,
    })

    const paste = pasteButton({
        onPaste: async () => {
            try {
                const { files, text } = await readClipboard()

                if (files.length === 0 && text === '') {
                    return say('There is nothing on the clipboard to paste.', 'error')
                }

                attach(files)
                message.addText(text)
            } catch {
                say('The browser did not let the extension read the clipboard.', 'error')
            }
        },
    })

    // From inside a tab there is no page beside it to capture.
    const screenshot = !inTab && button({
        variant: 'secondary',
        class: 'w-full gap-3 py-3',
        onClick: async () => {
            try {
                await startScreenshot()
                // Safari can retain a dismissed popup's storage listener. Leave
                // this capture for the composer that opens after selection.
                stopWatchingCaptures()
                window.close()
            } catch {
                say('Screenshots are not available on this page.', 'error')
            }
        },
    }, icon('scan', 'size-5'), 'Screenshot part of this page')

    const checkClipboard = () => clipboardHasSomethingToPaste().then(paste.show)
    checkClipboard()
    window.addEventListener('focus', checkClipboard)

    function attach(files) {
        const refused = files.filter((file) => fieldFor(file) === null)

        message.addFiles(files.filter((file) => fieldFor(file) !== null))
        status.replaceChildren(...refused.map((file) => note(`${file.name} cannot be remembered.`, 'error')))
    }

    async function save(composed) {
        message.setBusy(true)
        status.replaceChildren()

        try {
            await remember(composed)
            message.reset()
            say('Memory saved.')
        } catch (failure) {
            if (failure instanceof SignedOut) {
                return showLogIn()
            }

            say(failure instanceof TypeError ? 'We could not reach Remember This. Check your connection and try again.' : failure.message, 'error')
        } finally {
            message.setBusy(false)
        }
    }

    // Both stay mounted, as in the app, so switching keeps a half-written memory.
    const panels = {
        'remember-this': h(
            'div',
            { class: 'flex flex-col gap-4 p-4' },
            dropZone({ onFiles: attach, onBrowse: browse }),
            paste.element,
            screenshot,
            message.element,
            status,
            picker,
        ),
        'remind-me': recallPanel({ onSignedOut: showLogIn }),
    }

    const showMode = (chosen) => {
        for (const [name, panel] of Object.entries(panels)) {
            panel.hidden = name !== chosen
        }

        panels[chosen].querySelector('textarea').focus()
    }

    const modes = modeSwitch({
        selected: staged ? 'remember-this' : mode,
        onChange: (chosen) => {
            showMode(chosen)
            extension.storage.local.set({ mode: chosen })
        },
    })

    // What was captured from the page goes into the message field, to send or edit.
    const receive = ({ files, text }) => {
        modes.select('remember-this')
        showMode('remember-this')
        attach(files)
        message.addText(text)
    }

    showWith(
        modes.element,
        connected && h('div', { class: 'px-4 pt-4 -mb-2 empty:hidden' }, connectedNotice()),
        panels['remember-this'],
        panels['remind-me'],
    )

    showMode(staged ? 'remember-this' : mode)

    if (staged) {
        receive(staged)
    }

    const stopWatchingCaptures = whenStaged(receive)
    window.addEventListener('pagehide', stopWatchingCaptures, { once: true })
}

/**
 * Firefox closes a toolbar popup as soon as a native file picker opens, except
 * on Windows, and the choice is lost with it. There the popup reopens in a tab.
 */
async function pickerNeedsTab() {
    return !inTab
        && extension.runtime.getURL('').startsWith('moz-extension:')
        && (await extension.runtime.getPlatformInfo()).os !== 'win'
}
