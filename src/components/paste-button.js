import { button, buttonClasses } from './button.js'
import { icon } from './icon.js'

const SHAPE = 'w-full gap-3 py-3'

/**
 * Lit when the clipboard holds something pasteable, disabled when it holds
 * nothing, and plain but usable when the browser will not say until a click.
 */
export function pasteButton({ onPaste }) {
    const element = button({ variant: 'secondary', class: SHAPE, onClick: onPaste }, icon('clipboard', 'size-5'), 'Paste from clipboard')

    return {
        element,
        show(holdsSomething) {
            element.disabled = holdsSomething === false
            element.className = buttonClasses({ variant: holdsSomething ? 'accent-outline' : 'secondary', class: SHAPE })
        },
    }
}
