import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'

const TAB = { id: 7, windowId: 1, title: 'Garden planning notes', url: 'https://garden.test/notes' }
let stored, calls, menuClicked, popupOpens, fetched, selection
const captureListeners = new Set()

globalThis.__APP_URL__ = 'https://remember-this.test'
globalThis.chrome = {
    runtime: {
        onInstalled: { addListener: () => {} },
        onMessage: { addListener: () => {} },
        getURL: (path) => `chrome-extension://abcdefghijklmnop/${path}`,
    },
    contextMenus: { create: () => {}, onClicked: { addListener: (listener) => menuClicked = listener } },
    action: { openPopup: (options) => {
        assert.deepEqual(options, { windowId: TAB.windowId })
        calls.push('openPopup')
        return (typeof popupOpens === 'function' ? popupOpens() : popupOpens) ? Promise.resolve() : Promise.reject(new Error('No user gesture'))
    } },
    tabs: { create: async ({ url }) => calls.push(`tab ${url}`) },
    scripting: { executeScript: async () => [{ result: selection }] },
    storage: {
        local: {
            get: async (key) => (key in stored ? { [key]: stored[key] } : {}),
            set: async (values) => Object.assign(stored, values),
            remove: async (key) => delete stored[key],
        },
        onChanged: {
            addListener: (listener) => captureListeners.add(listener),
            removeListener: (listener) => captureListeners.delete(listener),
        },
    },
}

await import('../src/background.js')
const { takeStaged, whenStaged } = await import('../src/capture.js')

beforeEach(() => {
    stored = {}
    calls = []
    popupOpens = true
    selection = null
    captureListeners.clear()
    globalThis.fetch = async (url) => (fetched ? fetched(url) : new Response(null, { status: 404 }))
})

/** Clicks the menu item, then waits for the capture to land in storage. */
async function clickMenu(info) {
    menuClicked(info, TAB)
    const openedBeforeAnyAwait = calls[0] === 'openPopup'

    for (let tries = 0; tries < 50 && !stored.staged && !calls.some((call) => call.startsWith('tab ')); tries++) {
        await new Promise((resolve) => setTimeout(resolve, 5))
    }

    return openedBeforeAnyAwait
}

test('the popup is opened while the click is still being handled, as Firefox requires', async () => {
    assert.equal(await clickMenu({ selectionText: 'anything' }), true)
})

test('a selection keeps its line breaks and is followed by where it came from', async () => {
    selection = 'Plant the tomatoes after the last frost.\nWater the beans every other morning.'

    await clickMenu({ selectionText: 'Plant the tomatoes after the last frost. Water the beans every other morning.', frameId: 0 })

    assert.equal(stored.staged.text, `${selection}\n\nGarden planning notes\nhttps://garden.test/notes`)
})

test('a downloaded image is named for its real type, which is what the server goes by', async () => {
    fetched = () => new Response(new Blob(['jpeg bytes'], { type: 'image/jpeg' }))

    await clickMenu({ mediaType: 'image', srcUrl: 'https://cdn.garden.test/photos/tomatoes?w=800' })

    assert.equal(stored.staged.image.name, 'tomatoes.jpg')
    assert.match(stored.staged.image.dataUrl, /^data:image\/jpeg;base64,/)
    assert.equal(stored.staged.text, 'Garden planning notes\nhttps://garden.test/notes')
})

test('a link is remembered with the page it was on', async () => {
    await clickMenu({ linkUrl: 'https://seeds.test/catalogue' })

    assert.equal(stored.staged.text, 'https://seeds.test/catalogue\n\nGarden planning notes\nhttps://garden.test/notes')
})

test('where no popup can be opened, the capture still arrives in a tab', async () => {
    popupOpens = false

    await clickMenu({ selectionText: 'anything' })
    await new Promise((resolve) => setTimeout(resolve, 10))

    assert.deepEqual(calls, ['openPopup', 'openPopup', 'tab chrome-extension://abcdefghijklmnop/popup.html?tab'])
    assert.ok(stored.staged)
})

test('a cold popup is retried after staging without opening a composer tab', async () => {
    popupOpens = () => calls.filter((call) => call === 'openPopup').length > 1

    await clickMenu({ selectionText: 'anything' })
    await new Promise((resolve) => setTimeout(resolve, 10))

    assert.deepEqual(calls, ['openPopup', 'openPopup'])
    assert.ok(stored.staged)
})

test('the popup turns a staged capture back into a file and words, once', async () => {
    stored.staged = { text: 'Garden planning notes', image: { name: 'Screenshot.png', dataUrl: 'data:image/png;base64,iVBORw0KGgo=' } }
    globalThis.fetch = (url) => new Response(Buffer.from(url.split(',')[1], 'base64'), { headers: { 'Content-Type': 'image/png' } })

    const capture = await takeStaged()

    assert.equal(capture.text, 'Garden planning notes')
    assert.equal(capture.files[0].name, 'Screenshot.png')
    assert.equal(capture.files[0].type, 'image/png')
    assert.equal(capture.files[0].size, 8)
    assert.equal(stored.staged, undefined)
    assert.equal(await takeStaged(), null)
})

test('a dismissed composer leaves the screenshot for the reopened composer', async () => {
    const received = []
    const stopWatching = whenStaged((capture) => received.push(capture))
    stopWatching()

    stored.staged = { text: 'Garden planning notes', image: { name: 'Screenshot.png', dataUrl: 'data:image/png;base64,iVBORw0KGgo=' } }
    globalThis.fetch = (url) => new Response(Buffer.from(url.split(',')[1], 'base64'), { headers: { 'Content-Type': 'image/png' } })

    for (const listener of captureListeners) {
        listener({ staged: { newValue: stored.staged } }, 'local')
    }

    assert.deepEqual(received, [])
    const capture = await takeStaged()
    assert.equal(capture.files[0].name, 'Screenshot.png')
    assert.equal(capture.files[0].size, 8)
})

test('a screenshot stays staged if converting it to an attachment fails', async () => {
    stored.staged = { image: { name: 'Screenshot.png', dataUrl: 'data:image/png;base64,iVBORw0KGgo=' } }
    globalThis.fetch = async () => { throw new Error('Could not read image') }

    await assert.rejects(takeStaged(), /Could not read image/)
    assert.equal(stored.staged.image.name, 'Screenshot.png')
})
