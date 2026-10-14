import { extension } from './browser.js'

/**
 * Takes what background.js staged from the page (a selection, an image, a
 * screenshot) as files and words for the message field, and clears it.
 *
 * @returns {Promise<{files: File[], text: string} | null>}
 */
export async function takeStaged() {
    const { staged } = await extension.storage.local.get('staged')

    if (!staged) {
        return null
    }

    const files = staged.image
        ? [new File([await (await fetch(staged.image.dataUrl)).blob()], staged.image.name, { type: staged.image.dataUrl.slice(5, staged.image.dataUrl.indexOf(';')) })]
        : []

    await extension.storage.local.remove('staged')

    return { files, text: staged.text ?? '' }
}

/** Calls back with a capture staged after the popup opened, as the menu's often is. */
export function whenStaged(callback) {
    const listener = (changes, area) => {
        if (area === 'local' && changes.staged?.newValue) {
            takeStaged().then((capture) => capture && callback(capture))
        }
    }

    extension.storage.onChanged.addListener(listener)

    return () => extension.storage.onChanged.removeListener(listener)
}

/**
 * Puts the box-drawing overlay on the current tab. Opening the popup granted the
 * extension that tab, which is all scripting and the screenshot need.
 */
export async function startScreenshot() {
    const [tab] = await extension.tabs.query({ active: true, currentWindow: true })

    await extension.scripting.executeScript({ target: { tabId: tab.id }, files: ['region.js'] })
}
