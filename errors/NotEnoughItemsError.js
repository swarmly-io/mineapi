export class NotEnoughItemsError extends Error {
    constructor(itemId, needed, found) {
        super(`Bot doesn't have enough items of type ${itemId}: Found: ${found}, Needed: ${needed}`)
    }
}