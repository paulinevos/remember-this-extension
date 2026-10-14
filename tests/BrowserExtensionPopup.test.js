import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'

let scheme, attempts, fails
globalThis.__APP_URL__ = 'https://remember-this.test'
globalThis.chrome = {
    runtime: { getURL: (path) => `${scheme}://extension/${path}` },
    action: { openPopup: async () => {
        attempts++
        if (fails) throw new Error('Popup unavailable')
    } },
}

const { openConnectedPopup } = await import('../src/browser.js')

beforeEach(() => {
    scheme = 'chrome-extension'
    attempts = 0
    fails = false
})

test('Safari authentication leaves its confirmation tab without opening a transient popup', async () => {
    scheme = 'safari-web-extension'
    assert.equal(await openConnectedPopup(), false)
    assert.equal(attempts, 0)
})

test('Chrome authentication can open the connected popup', async () => {
    assert.equal(await openConnectedPopup(), true)
    assert.equal(attempts, 1)
})

test('a browser rejecting the connected popup leaves the confirmation available', async () => {
    fails = true
    assert.equal(await openConnectedPopup(), false)
})
