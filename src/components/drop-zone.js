import { h } from './element.js'
import { icon } from './icon.js'

export function dropZone({ onFiles, onBrowse }) {
    // Counted, because dragging over a child fires dragleave on the zone itself.
    let depth = 0

    const zone = h(
        'div',
        {
            class: 'flex flex-col items-center gap-2 rounded-field border border-dashed border-muted/50 px-4 py-5 text-sm transition duration-200 data-dragging:border-accent data-dragging:bg-accent-wash dark:border-muted-dark/50 dark:data-dragging:border-accent-dark dark:data-dragging:bg-accent-wash-dark',
            onDragenter: (event) => {
                event.preventDefault()
                depth++
                zone.dataset.dragging = ''
            },
            onDragover: (event) => event.preventDefault(),
            onDragleave: () => {
                if (--depth === 0) {
                    delete zone.dataset.dragging
                }
            },
            onDrop: (event) => {
                event.preventDefault()
                depth = 0
                delete zone.dataset.dragging
                onFiles([...event.dataTransfer.files])
            },
        },
        icon('cloud-upload', 'size-8 stroke-[1.5]'),
        h(
            'p',
            {},
            'Drop files or ',
            h('button', { type: 'button', class: 'font-medium text-accent hover:underline dark:text-accent-dark', onClick: onBrowse }, 'browse'),
        ),
    )

    return zone
}
