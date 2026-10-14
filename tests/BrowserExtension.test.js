import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'

const CALLBACK = 'chrome-extension://abcdefghijklmnop/callback.html'
let stored, requests, answers, opened

globalThis.__APP_URL__ = 'https://remember-this.test'
globalThis.chrome = {
    runtime: { getURL: (path) => `chrome-extension://abcdefghijklmnop/${path}` },
    tabs: { create: async ({ url }) => opened.push(url) },
    storage: {
        local: {
            get: async (key) => (key in stored ? { [key]: structuredClone(stored[key]) } : {}),
            set: async (values) => Object.assign(stored, structuredClone(values)),
            remove: async (key) => delete stored[key],
        },
    },
}
globalThis.fetch = async (url, init = {}) => {
    const request = { path: new URL(url).pathname, search: new URL(url).search, init }
    requests.push(request)
    const [status, body] = answers.shift()(request)
    return new Response(JSON.stringify(body), { status })
}

const { beginLogIn, completeLogIn, authorizedFetch, SignedOut } = await import('../src/connection.js')
const { fieldFor, mediaUrl, recall, remember } = await import('../src/memories.js')

beforeEach(() => {
    stored = {}
    requests = []
    answers = []
    opened = []
})

const base64Url = (buffer) => buffer.toString('base64').replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')

test('logging in proves itself with PKCE and refuses a callback it did not start', async () => {
    answers.push(() => [201, { client_id: 'client-1' }])
    await beginLogIn()

    const authorize = new URL(opened[0])
    const { verifier, state } = stored.pendingLogIn
    assert.equal(authorize.searchParams.get('redirect_uri'), CALLBACK)
    assert.equal(authorize.searchParams.get('prompt'), 'consent')
    assert.equal(authorize.searchParams.get('code_challenge_method'), 'S256')
    assert.equal(authorize.searchParams.get('code_challenge'), base64Url(createHash('sha256').update(verifier).digest()))

    answers.push(() => [200, { access_token: 'stolen', refresh_token: 'stolen' }])
    await assert.rejects(completeLogIn(`?code=stolen&state=${state}-forged`), /not started from the extension/)
    assert.equal(stored.session, undefined)
    assert.equal(requests.filter((request) => request.path === '/oauth/token').length, 0)
    answers = []
    assert.equal(stored.pendingLogIn, undefined, 'a refused callback cannot be replayed')

    await beginLogIn()
    assert.equal(requests.filter((request) => request.path === '/oauth/register').length, 1, 'the install registers once')

    const pending = stored.pendingLogIn
    answers.push(() => [200, { access_token: 'access-1', refresh_token: 'refresh-1' }])
    assert.equal(await completeLogIn(`?code=the-code&state=${pending.state}`), true)

    const exchange = new URLSearchParams(requests.at(-1).init.body)
    assert.equal(exchange.get('code'), 'the-code')
    assert.equal(exchange.get('code_verifier'), pending.verifier)
    assert.equal(exchange.get('redirect_uri'), CALLBACK)
    assert.deepEqual(stored.session, { accessToken: 'access-1', refreshToken: 'refresh-1', clientId: 'client-1' })
    assert.equal(stored.justConnected, true)
})

test('choosing Cancel on the consent screen connects nothing', async () => {
    stored.pendingLogIn = { clientId: 'client-1', verifier: 'v', state: 's' }

    assert.equal(await completeLogIn('?error=access_denied&state=s'), false)
    assert.equal(stored.session, undefined)
    assert.deepEqual(requests, [])
})

test('an expired token is refreshed once and the request retried with the new one', async () => {
    stored.session = { accessToken: 'old', refreshToken: 'refresh-1', clientId: 'client-1' }
    answers.push(() => [401, {}], () => [200, { access_token: 'new', refresh_token: 'refresh-2' }], () => [200, {}])

    const response = await authorizedFetch('/api/documents/allowance')

    assert.equal(response.status, 200)
    assert.equal(requests[2].init.headers.Authorization, 'Bearer new')
    assert.equal(new URLSearchParams(requests[1].init.body).get('refresh_token'), 'refresh-1')
    assert.equal(stored.session.refreshToken, 'refresh-2')
})

test('a refused refresh means the extension was disconnected, so it signs out', async () => {
    stored.session = { accessToken: 'revoked', refreshToken: 'revoked-too', clientId: 'client-1' }
    answers.push(() => [401, {}], () => [400, { error: 'invalid_grant' }])

    await assert.rejects(authorizedFetch('/api/memories'), SignedOut)
    assert.equal(stored.session, undefined)
})

test('files are sent first, each under the field the server validates it as, and the words last', async () => {
    stored.session = { accessToken: 'access', refreshToken: null, clientId: 'client-1' }
    answers.push(() => [201, {}])

    await remember({
        files: [new File(['%PDF'], 'Exam planning.PDF'), new File(['png'], 'board.jpeg'), new File(['ogg'], 'reminder.m4a')],
        text: 'This school year’s exam planning.',
    })

    assert.deepEqual([...requests[0].init.body.keys()], [
        'messages[0][document]',
        'messages[1][image]',
        'messages[2][voice]',
        'messages[3][text]',
    ])
    assert.equal(fieldFor(new File([''], 'notes.md')), 'document')
    assert.equal(fieldFor(new File([''], 'notes.txt')), null)
    assert.equal(fieldFor(new File([''], 'pdf')), null)
})

test('a refusal is reported in the sentence the server wrote', async () => {
    stored.session = { accessToken: 'access', refreshToken: null, clientId: 'client-1' }
    answers.push(() => [422, { message: 'Your free document allowance for this month is used up.' }])

    await assert.rejects(remember({ files: [], text: 'hello' }), { message: 'Your free document allowance for this month is used up.' })
})

test('recall asks with the words as typed and fetches a memory\'s files with the token', async () => {
    stored.session = { accessToken: 'access', refreshToken: null, clientId: 'client-1' }
    answers.push(() => [200, { data: [{ id: 'memory-1', notes: [] }], meta: { count: 1 } }])
    answers.push(() => [200, {}])

    const memories = await recall('the boiler & the key?')
    await mediaUrl('https://remember-this.test/api/memories/memory-1/image/0?expires=1&signature=abc')

    assert.deepEqual(memories, [{ id: 'memory-1', notes: [] }])
    assert.equal(requests[0].path, '/api/memories')
    assert.equal(requests[0].search, '?query=the+boiler+%26+the+key%3F')
    assert.equal(requests[1].search, '?expires=1&signature=abc')
    assert.equal(requests[1].init.headers.Authorization, 'Bearer access')
})
