/**
 * Builds an element. `on*` attributes become listeners, `true` becomes an empty
 * attribute, and `false`, null and undefined are left off, so do children.
 */
export function h(tag, attributes = {}, ...children) {
    const element = document.createElement(tag)

    for (const [name, value] of Object.entries(attributes)) {
        if (value === false || value === null || value === undefined) {
            continue
        }

        if (name.startsWith('on')) {
            element.addEventListener(name.slice(2).toLowerCase(), value)
        } else {
            element.setAttribute(name, value === true ? '' : value)
        }
    }

    element.append(...children.flat().filter((child) => child !== false && child !== null && child !== undefined))

    return element
}
