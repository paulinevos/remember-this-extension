/**
 * Injected into the page when the popup's screenshot button is pressed: drag a
 * box over the part of the page to keep, and the background crops a screenshot
 * to it. Lives in a closed shadow root so the page's styles cannot reach it.
 *
 * Imports nothing, because scripting.executeScript runs files as plain scripts.
 */
(() => {
    if (document.getElementById('remember-this-region')) {
        return
    }

    const extension = globalThis.browser ?? globalThis.chrome

    const host = document.createElement('div')
    host.id = 'remember-this-region'
    host.style.cssText = 'all: initial; position: fixed; inset: 0; z-index: 2147483647;'

    const shadow = host.attachShadow({ mode: 'closed' })
    const style = document.createElement('style')
    style.textContent = `
        .scrim { position: fixed; inset: 0; cursor: crosshair; background: rgb(14 18 20 / 0.35); }
        .scrim.selecting { background: transparent; }
        .box { position: fixed; border: 2px solid #4fb3a9; border-radius: 4px; box-shadow: 0 0 0 100vmax rgb(14 18 20 / 0.45); pointer-events: none; }
        .pill { position: fixed; left: 50%; transform: translateX(-50%); padding: 8px 14px; border-radius: 999px; background: #0e1214; color: #e8eef0; font: 13px/1.4 system-ui, sans-serif; box-shadow: 0 4px 12px rgb(0 0 0 / 0.25); pointer-events: none; white-space: nowrap; }
        .hint { top: 16px; }
        .toast { bottom: 24px; }
    `

    const scrim = document.createElement('div')
    scrim.className = 'scrim'
    const box = document.createElement('div')
    box.className = 'box'
    box.hidden = true
    const hint = pill('hint', 'Drag over what you want to remember. Esc cancels.')

    shadow.append(style, scrim, box, hint)
    document.documentElement.append(host)

    let start = null
    let rect = null

    scrim.addEventListener('pointerdown', (event) => {
        start = { x: event.clientX, y: event.clientY }
        scrim.setPointerCapture(event.pointerId)
        scrim.classList.add('selecting')
        hint.remove()
    })

    scrim.addEventListener('pointermove', (event) => {
        if (!start) {
            return
        }

        rect = {
            x: Math.min(start.x, event.clientX),
            y: Math.min(start.y, event.clientY),
            width: Math.abs(event.clientX - start.x),
            height: Math.abs(event.clientY - start.y),
        }

        Object.assign(box.style, { left: `${rect.x}px`, top: `${rect.y}px`, width: `${rect.width}px`, height: `${rect.height}px` })
        box.hidden = false
    })

    scrim.addEventListener('pointerup', () => {
        // A click rather than a drag is taken as changing one's mind.
        if (!rect || rect.width < 8 || rect.height < 8) {
            return close()
        }

        capture({ ...rect, viewportWidth: innerWidth, viewportHeight: innerHeight })
    })

    addEventListener('keydown', onKeydown, true)

    function onKeydown(event) {
        if (event.key === 'Escape') {
            event.preventDefault()
            event.stopPropagation()
            close()
        }
    }

    function close() {
        removeEventListener('keydown', onKeydown, true)
        host.remove()
    }

    async function capture(region) {
        close()

        // Two frames, so the overlay is gone from the screen before it is captured.
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))

        const answer = await extension.runtime.sendMessage({ type: 'remember-this:region', rect: region }).catch(() => null)

        if (!answer?.captured) {
            return toast('That screenshot could not be taken.')
        }

        if (!answer.opened) {
            toast('Screenshot ready. Open remember this from the toolbar to save it.')
        }
    }

    function toast(text) {
        const toastHost = document.createElement('div')
        toastHost.style.cssText = 'all: initial; position: fixed; inset: auto 0 0 0; z-index: 2147483647;'
        const toastShadow = toastHost.attachShadow({ mode: 'closed' })
        toastShadow.append(style.cloneNode(true), pill('toast', text))
        document.documentElement.append(toastHost)
        setTimeout(() => toastHost.remove(), 5000)
    }

    function pill(position, text) {
        const element = document.createElement('p')
        element.className = `pill ${position}`
        element.setAttribute('role', 'status')
        element.textContent = text

        return element
    }
})()
