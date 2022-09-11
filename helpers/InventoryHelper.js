import { NotEnoughItemsError } from '../errors/NotEnoughItemsError.js'

export const assertHas = (bot, count, itemFilter) => {

    let itemCount = 0

    if (typeof itemFilter === 'number') {
        itemCount = bot.inventory.count(itemFilter)
    } else if (typeof itemFilter === 'function') {
        itemCount = bot.inventory.items()
            .filter(x => itemFilter(x))
            .reduce((a, b) => a + b, 0)
    }

    if (itemCount < count)
        throw new NotEnoughItemsError()
}