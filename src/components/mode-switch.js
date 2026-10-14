import { h } from './element.js'

const MODES = { 'remember-this': 'memorize', 'remind-me': 'recall' }

/**
 * The app header's memorize / recall pill, drawn with the same classes so it
 * slides the same way: the container says which mode is selected, the option
 * that is current is the lit one.
 */
export function modeSwitch({ selected, onChange }) {
    const options = Object.entries(MODES).map(([mode, label]) => h(
        'button',
        {
            type: 'button',
            'data-mode': mode,
            class: 'memory-mode-option inline-flex items-center justify-center rounded-full px-2 py-1 whitespace-nowrap transition-colors duration-200',
            onClick: () => {
                select(mode)
                onChange(mode)
            },
        },
        label,
    ))

    const element = h(
        'nav',
        { class: 'memory-mode-switch relative isolate grid shrink-0 grid-cols-2 rounded-full p-0.5 font-display text-[0.8125rem] font-normal', 'aria-label': 'Mode' },
        h('span', { class: 'memory-mode-thumb pointer-events-none absolute inset-y-0.5 left-0.5 -z-10 rounded-full bg-switch-active shadow-paper', 'aria-hidden': 'true' }),
        options,
    )

    function select(mode) {
        element.dataset.selected = mode

        for (const option of options) {
            if (option.dataset.mode === mode) {
                option.setAttribute('aria-current', 'page')
            } else {
                option.removeAttribute('aria-current')
            }
        }
    }

    select(selected)

    return { element, select }
}
