

module.exports = class BlockNotFoundError extends Error {
    constructor(blockId) {
        super(`Could not find block of type ${blockId}`)
    }
}