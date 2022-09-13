export class RecipeNotFoundError extends Error {
    constructor(itemId: number) {
        super(`Could not find a suitable recipe for item of type ${itemId}`)
    }
}