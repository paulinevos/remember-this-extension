/**
 * Firefox and Safari expose the WebExtension APIs as `browser`, Chromium as
 * `chrome`. Every call made here exists in both and returns a promise in both.
 */
export const extension = globalThis.browser ?? globalThis.chrome

/** The server this build was made for, set by vite.extension.config.js. */
export const appUrl = __APP_URL__

/** Safari's callback stays open; closing its tab can dismiss a pending popup. */
export async function openConnectedPopup() {
    if (extension.runtime.getURL('callback.html').startsWith('safari-web-extension:')) {
        return false
    }

    try {
        await extension.action.openPopup()
        return true
    } catch {
        return false
    }
}
