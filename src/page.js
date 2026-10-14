import './extension.css'
import { header } from './components/header.js'

const POPUP = 'w-[22.5rem]'
const TAB = 'mx-auto my-10 w-full max-w-sm overflow-hidden rounded-lg border border-line bg-canvas shadow-paper dark:border-line-dark dark:bg-canvas-dark'

/**
 * Prepares an extension page: the app's palette following the system theme, and
 * a toolbar popup's width, or a card when the page is open in a tab.
 */
export function page({ inTab }) {
    const dark = matchMedia('(prefers-color-scheme: dark)')
    const applyTheme = () => {
        document.documentElement.dataset.theme = dark.matches ? 'dark' : 'light'
    }

    applyTheme()
    dark.addEventListener('change', applyTheme)

    const root = document.getElementById('app')
    root.className = inTab ? TAB : POPUP

    return {
        show(...content) {
            root.replaceChildren(header(), ...content.filter(Boolean))
        },
        /** Like show, with something beside the wordmark. */
        showWith(beside, ...content) {
            root.replaceChildren(header(beside), ...content.filter(Boolean))
        },
    }
}
