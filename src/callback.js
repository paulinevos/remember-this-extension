import { extension, openConnectedPopup } from './browser.js'
import { h } from './components/element.js'
import { connectedNotice, note } from './components/note.js'
import { completeLogIn } from './connection.js'
import { page } from './page.js'

const { show } = page({ inTab: true })
const body = (...content) => h('div', { class: 'flex flex-col gap-3 p-6' }, ...content)

finish()

async function finish() {
    show(body(h('p', { class: 'text-sm text-muted dark:text-muted-dark' }, 'Connecting…')))

    try {
        if (!await completeLogIn(location.search)) {
            return closeThisTab()
        }
    } catch (failure) {
        return show(body(note(`${failure.message} Open the extension and log in again.`, 'error')))
    }

    if (await openConnectedPopup()) {
        return closeThisTab()
    }

    show(body(
        connectedNotice(),
        h('p', { class: 'text-sm text-muted dark:text-muted-dark' }, 'Open Remember This from the toolbar to start saving. You can close this tab.'),
    ))
}

async function closeThisTab() {
    await extension.tabs.remove((await extension.tabs.getCurrent()).id)
}
