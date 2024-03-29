import { NotEnoughItemsError } from '../errors/NotEnoughItemsError'
import { Observation } from '../types'

export const assertHas = (observation: Observation, count: number, itemFilter: number | string | ((itemId: number | string) => boolean)) => {
    let itemCount = 0
    
    if (typeof itemFilter === 'number' || typeof itemFilter === 'string') {
        itemCount = observation.inventory.items[itemFilter] ?? 0
    } else if (typeof itemFilter === 'function') {
        itemCount = Object.keys(observation.inventory.items)
            .filter(x => itemFilter(x))
            .map(key => observation.inventory.items[key])
            .reduce((a, b) => a + b, 0)
    }

    if (itemCount < count)
        throw new NotEnoughItemsError(((typeof itemFilter === 'number' || typeof itemFilter === 'string') ? itemFilter as number : -1), count, itemCount)
}