import { Block } from 'prismarine-block'
import { BlockNotFoundError } from "../errors/BlockNotFoundError"
import { NotEnoughItemsError } from "../errors/NotEnoughItemsError"
import { findBlocks } from "../helpers/EnvironmentHelper"
import { assertHas } from "../helpers/InventoryHelper"
import { Observation, Consequences } from "../types"
import { Action, ActionParams } from "./Action"
import { ActionDoResult } from './types'

export type FindAndCollectParams = {
    blockIds: number | number[],
    amountToCollect: number,
    allowedMaxDistance: number
}

export class FindAndCollectAction extends Action<FindAndCollectParams> {

    //TODO: Maybe we should check if the bot has the tools
    //      to mine the block type, and automatically equip 
    //      the best tool to mine it
    // - the collectblock plugin actually automatically selects the best tool
    constructor(params: ActionParams<FindAndCollectParams>) {
        super(params)
    }

    async do(): Promise<ActionDoResult> { // TODO: Do we need metadata?        
        const blocks = findBlocks(this.bot, this.options.blockIds, this.options.allowedMaxDistance, this.options.amountToCollect)

        if (blocks.length === 0) {
            return { reason: "FindAndCollectBlock: No blocks found" }
        }

        const targets: Block[] = []
        for (let i = 0; i < Math.min(blocks.length, this.options.amountToCollect); i++) {
            let block = this.bot.blockAt(blocks[i])
            if (block)
                targets.push(block!)
        }

        //@ts-ignore  ts doesnt know about mineflayer plugins
        await this.bot.collectBlock.collect(targets)

        return true
    }

    async possible (observation: Observation): Promise<Consequences> {
        let blockTypes = typeof this.options.blockIds === 'number' ? [this.mcData.blocks[this.options.blockIds]] : this.options.blockIds.map(x => this.mcData.blocks[x])
        // Now checking for harvest tools
        let mineableBlockTypes = blockTypes.filter(blockType => {
            if (blockType.harvestTools !== undefined) {
                try{
                    assertHas(observation, 1, (i => Object.keys(blockType.harvestTools!).includes(i as string)))
                } catch (e) {
                    if (e instanceof NotEnoughItemsError){
                        return false
                    } else throw e
                }
            }
            return true
        })
        if (mineableBlockTypes.length === 0) {
            return { success: false, reason: "FindAndCollectResource: No blocks found" }
        }

        const blocks = findBlocks(this.bot, mineableBlockTypes.map(x => x.id), this.options.allowedMaxDistance, this.options.amountToCollect, observation.position)
        
        if (blocks.length < this.options.amountToCollect) {
            return { success: false, reason: "FindAndCollectResource: Not enough blocks found" }
        }

        // WARNING:
        // Since we cannot know what blocks the bot will actually collect in the do() method (when multiple blockIds were provided),
        // this will just return the drops of the first mineable block type it finds
        // This shoudn't be a problem when farming for example different kinds of woods, but it cannot be used for farming different blocks
        let inv = Object.fromEntries(mineableBlockTypes[0].drops.map(x => [x, this.options.amountToCollect]))
        return {
            success: true,
            inventory: inv
        }
    }
}