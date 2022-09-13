export class BlockNotFoundError extends Error {
    constructor(blockId: number) {
        super(`Could not find block of type ${blockId}`)
    }
}