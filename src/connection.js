import { appUrl, extension } from './browser.js'

/**
 * Raised when nobody is connected, or the connection has been revoked, so the
 * popup can fall back to its logged-out state.
 */
export class SignedOut extends Error {}

const storage = () => extension.storage.local
const callbackUrl = () => extension.runtime.getURL('callback.html')

export async function currentSession() {
    return (await storage().get('session')).session ?? null
}

/** Whether a connection was made since the popup last said so. Asking clears it. */
export async function takeJustConnected() {
    const { justConnected } = await storage().get('justConnected')
    await storage().remove('justConnected')

    return justConnected === true
}

/**
 * Starts OAuth (authorization code with PKCE) in a tab. The popup closes as soon
 * as the tab takes focus, so everything the callback page needs is stored first.
 */
export async function beginLogIn() {
    const client = await registeredClient()
    const verifier = randomString(48)
    const state = randomString(24)

    await storage().set({ pendingLogIn: { clientId: client.id, verifier, state } })

    const authorize = new URL('/oauth/authorize', appUrl)
    authorize.search = new URLSearchParams({
        response_type: 'code',
        // Always visit the app's consent page before returning to the extension.
        // Safari can reject a direct redirect into an extension resource when
        // an existing website session lets authorization finish immediately.
        prompt: 'consent',
        client_id: client.id,
        redirect_uri: callbackUrl(),
        state,
        code_challenge: await challengeFor(verifier),
        code_challenge_method: 'S256',
    })

    await extension.tabs.create({ url: authorize.href })
}

/**
 * Finishes what beginLogIn started, from the query string the server redirected
 * the callback page to. Resolves false when the person chose Cancel.
 */
export async function completeLogIn(query) {
    const answer = new URLSearchParams(query)
    const { pendingLogIn } = await storage().get('pendingLogIn')
    await storage().remove('pendingLogIn')

    if (!pendingLogIn || answer.get('state') !== pendingLogIn.state) {
        throw new Error('This sign-in was not started from the extension.')
    }

    if (answer.has('error')) {
        return false
    }

    const session = await requestTokens({
        grant_type: 'authorization_code',
        client_id: pendingLogIn.clientId,
        redirect_uri: callbackUrl(),
        code_verifier: pendingLogIn.verifier,
        code: answer.get('code') ?? '',
    })

    if (!session) {
        throw new Error('The server did not accept the sign-in.')
    }

    await storage().set({ session: { ...session, clientId: pendingLogIn.clientId }, justConnected: true })

    return true
}

/**
 * A request to the API as the connected person. An expired access token is
 * refreshed once; a refused refresh means the extension was disconnected.
 */
export async function authorizedFetch(path, init = {}) {
    const session = await currentSession()

    if (!session) {
        throw new SignedOut()
    }

    const response = await fetch(new URL(path, appUrl), withToken(init, session.accessToken))

    if (response.status !== 401) {
        return response
    }

    const refreshed = session.refreshToken && await requestTokens({
        grant_type: 'refresh_token',
        client_id: session.clientId,
        refresh_token: session.refreshToken,
    })

    if (refreshed) {
        await storage().set({ session: { ...refreshed, clientId: session.clientId } })

        const retried = await fetch(new URL(path, appUrl), withToken(init, refreshed.accessToken))

        if (retried.status !== 401) {
            return retried
        }
    }

    await storage().remove('session')

    throw new SignedOut()
}

async function registeredClient() {
    const { client } = await storage().get('client')

    // Firefox and Safari give every install its own extension URL, so each
    // install registers itself rather than sharing one pre-registered client.
    if (client?.redirectUri === callbackUrl()) {
        return client
    }

    const response = await fetch(new URL('/oauth/register', appUrl), {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_name: 'Remember This browser extension', redirect_uris: [callbackUrl()] }),
    })

    if (!response.ok) {
        throw new Error('The extension could not register with Remember This.')
    }

    const registered = { id: (await response.json()).client_id, redirectUri: callbackUrl() }
    await storage().set({ client: registered })

    return registered
}

async function requestTokens(fields) {
    const response = await fetch(new URL('/oauth/token', appUrl), {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: new URLSearchParams(fields),
    })

    if (!response.ok) {
        return null
    }

    const tokens = await response.json()

    return { accessToken: tokens.access_token, refreshToken: tokens.refresh_token ?? null }
}

function withToken(init, accessToken) {
    return { ...init, headers: { Accept: 'application/json', ...init.headers, Authorization: `Bearer ${accessToken}` } }
}

function randomString(bytes) {
    return base64Url(crypto.getRandomValues(new Uint8Array(bytes)))
}

async function challengeFor(verifier) {
    return base64Url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))))
}

function base64Url(bytes) {
    return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}
