export class NotEnoughItemsError extends Error {
    constructor(itemId: number, needed: number, found: number) {
        super(`Bot doesn't have enough items of type ${itemId}: Found: ${found}, Needed: ${needed}`)
    }
}