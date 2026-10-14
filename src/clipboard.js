const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp']

const pasteable = (type) => type === 'text/plain' || IMAGE_TYPES.includes(type)

/**
 * Whether the clipboard holds words or an image. Null when the browser will only
 * say after a click: Safari has no clipboardRead permission to ask in advance.
 */
export async function clipboardHasSomethingToPaste() {
    try {
        const items = await navigator.clipboard.read()

        return items.some((item) => item.types.some(pasteable))
    } catch {
        return null
    }
}

/** @returns {Promise<{files: File[], text: string}>} */
export async function readClipboard() {
    const files = []
    let text = ''

    for (const item of await navigator.clipboard.read()) {
        const image = item.types.find((type) => IMAGE_TYPES.includes(type))

        if (image) {
            files.push(new File([await item.getType(image)], `Pasted image.${image.split('/')[1]}`, { type: image }))
        } else if (item.types.includes('text/plain')) {
            text += await (await item.getType('text/plain')).text()
        }
    }

    return { files, text }
}
