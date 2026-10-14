/**
 * The right-click "Remember this" menu, and the screenshot the page overlay
 * (region.js) asks for. Both stage what they captured for the popup, which
 * picks it up into the message field, and then open it.
 *
 * Imports nothing: Chrome runs this as a service worker, Firefox and Safari as
 * a classic background script, and only a self-contained file works as both.
 */
const extension = globalThis.browser ?? globalThis.chrome
const IMAGE_EXTENSIONS = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }

extension.runtime.onInstalled.addListener(() => {
    extension.contextMenus.create({ id: 'remember-this', title: 'Remember this', contexts: ['selection', 'image', 'link', 'page'] })
})

extension.contextMenus.onClicked.addListener((info, tab) => {
    // Firefox only lets the popup open while the click is still being handled,
    // so it opens first and the popup picks up the capture when it lands.
    const opening = openPopup(tab.windowId).then(() => true, () => false)

    captureFromMenu(info, tab)
        .then((staged) => extension.storage.local.set({ staged }))
        .then(async () => {
            if (await opening) {
                return
            }

            // Safari may reject a cold popup before its page has loaded.
            // Retry after staging, keeping the popup in the clicked window.
            return openPopup(tab.windowId)
                .catch(() => extension.tabs.create({ url: extension.runtime.getURL('popup.html?tab') }))
        })
        .catch((failure) => console.error('Remember This could not capture the page.', failure))
})

extension.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type !== 'remember-this:region') {
        return false
    }

    crop(sender.tab.windowId, message.rect)
        .then((image) => extension.storage.local.set({ staged: { text: sourceOf(sender.tab), image } }))
        .then(() => openPopup(sender.tab.windowId).then(() => true, () => false))
        .then((opened) => sendResponse({ captured: true, opened }), () => sendResponse({ captured: false }))

    return true
})

function openPopup(windowId) {
    return extension.action.openPopup ? extension.action.openPopup({ windowId }) : Promise.reject(new Error('No popup to open.'))
}

async function captureFromMenu(info, tab) {
    const source = sourceOf(tab)

    if (info.mediaType === 'image' && info.srcUrl) {
        return { text: source, image: await imageFrom(info, tab) }
    }

    if (info.selectionText) {
        return { text: `${await selectionIn(info, tab) ?? info.selectionText}\n\n${source}` }
    }

    if (info.linkUrl) {
        return { text: `${info.linkUrl}\n\n${source}` }
    }

    return { text: source }
}

/** Where something came from, written under it so it can be found by the page too. */
function sourceOf(tab) {
    return [tab?.title, tab?.url].filter(Boolean).join('\n')
}

/** The selection with its line breaks, which the menu's own selectionText collapses. */
async function selectionIn(info, tab) {
    try {
        const [{ result }] = await extension.scripting.executeScript({
            target: { tabId: tab.id, frameIds: [info.frameId ?? 0] },
            func: () => getSelection().toString(),
        })

        return result?.trim() ? result : null
    } catch {
        return null
    }
}

/**
 * The image itself when its server lets the extension download it, otherwise
 * the part of the page it is shown in, cut out of a screenshot.
 */
async function imageFrom(info, tab) {
    try {
        const response = await fetch(info.srcUrl)

        if (response.ok) {
            return await asImage(await response.blob(), nameFrom(info.srcUrl))
        }
    } catch {
        // Falls through to the screenshot.
    }

    const [{ result: rect }] = await extension.scripting.executeScript({
        target: { tabId: tab.id },
        func: (src) => {
            const image = [...document.images].find((candidate) => candidate.currentSrc === src || candidate.src === src)

            if (!image) {
                return null
            }

            const { left, top, width, height } = image.getBoundingClientRect()

            return { x: left, y: top, width, height, viewportWidth: innerWidth, viewportHeight: innerHeight }
        },
        args: [info.srcUrl],
    })

    if (!rect) {
        throw new Error('The image is not on the page.')
    }

    return { ...await crop(tab.windowId, rect), name: `${nameFrom(info.srcUrl).replace(/\.[^.]*$/, '') || 'Image'}.png` }
}

/**
 * Kept as sent when the server accepts its type, redrawn as a PNG when not, and
 * named for what it is: the popup and the server both go by the extension.
 */
async function asImage(blob, name) {
    const base = name.replace(/\.[^.]*$/, '') || 'Image'

    if (blob.type in IMAGE_EXTENSIONS) {
        return { name: `${base}.${IMAGE_EXTENSIONS[blob.type]}`, dataUrl: await dataUrlOf(blob) }
    }

    const bitmap = await createImageBitmap(blob)
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
    canvas.getContext('2d').drawImage(bitmap, 0, 0)

    return { name: `${base}.png`, dataUrl: await dataUrlOf(await canvas.convertToBlob({ type: 'image/png' })) }
}

/** The visible part of rect, in CSS pixels of a viewport viewportWidth wide, from a screenshot of the tab. */
async function crop(windowId, rect) {
    const screenshot = await extension.tabs.captureVisibleTab(windowId, { format: 'png' })
    const bitmap = await createImageBitmap(await (await fetch(screenshot)).blob())
    const scale = bitmap.width / rect.viewportWidth

    const left = Math.max(0, rect.x)
    const top = Math.max(0, rect.y)
    const width = Math.min(rect.viewportWidth, rect.x + rect.width) - left
    const height = Math.min(rect.viewportHeight, rect.y + rect.height) - top

    if (width < 1 || height < 1) {
        throw new Error('Nothing of that is on screen.')
    }

    const canvas = new OffscreenCanvas(Math.round(width * scale), Math.round(height * scale))
    canvas.getContext('2d').drawImage(bitmap, left * scale, top * scale, width * scale, height * scale, 0, 0, canvas.width, canvas.height)

    return { name: 'Screenshot.png', dataUrl: await dataUrlOf(await canvas.convertToBlob({ type: 'image/png' })) }
}

function nameFrom(url) {
    try {
        return decodeURIComponent(new URL(url).pathname.split('/').pop()) || 'Image'
    } catch {
        return 'Image'
    }
}

/** FileReader is not there in a service worker, so the bytes are encoded by hand. */
async function dataUrlOf(blob) {
    const bytes = new Uint8Array(await blob.arrayBuffer())
    let binary = ''

    for (let start = 0; start < bytes.length; start += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(start, start + 0x8000))
    }

    return `data:${blob.type};base64,${btoa(binary)}`
}
