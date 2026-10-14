import { authorizedFetch } from './connection.js'

/**
 * The files /api/memories accepts, by the message field each arrives in. Kept in
 * step with ImageFormat::extensions(), DocumentFormat::extensions() and
 * AudioFormat::extensions(), which are what the server validates against.
 */
const EXTENSIONS = {
    image: ['png', 'jpg', 'jpeg', 'webp'],
    document: ['md', 'markdown', 'pdf', 'doc', 'docx'],
    voice: ['wav', 'mp3', 'ogg', 'oga', 'opus', 'aac', 'm4a', 'mp4', 'flac', 'webm'],
}

export const acceptedFiles = Object.values(EXTENSIONS).flat().map((extension) => `.${extension}`).join(',')

/** The message field a file is sent as, or null when it cannot be remembered. */
export function fieldFor(file) {
    const extension = /\.([^.]+)$/.exec(file.name)?.[1].toLowerCase()

    return Object.keys(EXTENSIONS).find((field) => EXTENSIONS[field].includes(extension)) ?? null
}

/** Saves the files and the words written with them as one memory, files first. */
export async function remember({ files, text }) {
    const body = new FormData()

    files.forEach((file, index) => body.append(`messages[${index}][${fieldFor(file)}]`, file, file.name))

    if (text.trim() !== '') {
        body.append(`messages[${files.length}][text]`, text)
    }

    const response = await authorizedFetch('/api/memories', { method: 'POST', body })

    if (!response.ok) {
        throw new Error(await refusal(response))
    }
}

/** The memories that best match a description, most relevant first. */
export async function recall(query) {
    const response = await authorizedFetch(`/api/memories?${new URLSearchParams({ query })}`)

    if (!response.ok) {
        throw new Error(await refusal(response))
    }

    return (await response.json()).data
}

/**
 * A memory's photo, recording or document as a local URL. The signed links the
 * API hands out still need the bearer token, which an <img> or <audio> cannot send.
 */
export async function mediaUrl(signedUrl) {
    const response = await authorizedFetch(signedUrl)

    if (!response.ok) {
        throw new Error('This file could not be loaded.')
    }

    return URL.createObjectURL(await response.blob())
}

async function refusal(response) {
    if (response.status === 422) {
        return (await response.json()).message
    }

    if (response.status === 429) {
        return 'That is a lot in one minute. Wait a moment, then try again.'
    }

    return 'Something went wrong on our side. Please try again in a moment.'
}
