import { assertHas } from "./helpers/InventoryHelper.js"
import { NotEnoughItemsError } from "./errors/NotEnoughItemsError.js"
import { findBlock, findBlocks } from "./helpers/EnvironmentHelper.js"
import { BlockNotFoundError } from "./errors/BlockNotFoundError.js"
import { Bot } from "mineflayer"
import { IndexedData } from "minecraft-data"
import { Block } from 'prismarine-block'
import { RecipeNotFoundError } from "./errors/RecipeNotFoundError.js"
import { parseRecipe } from "./helpers/RecipeHelper.js"
import { Consequences, Observation } from "./types.js"

const DEFAULT_ALLOWED_DISTANCE = 16

export class Action {
    bot: Bot
    mcData: IndexedData

    constructor(bot: Bot, mcData: IndexedData) {
        this.bot = bot
        this.mcData = mcData
    }

    async do(): Promise<any> {    
        throw new Error('Cannot call do() on empty action')
    }

    async possible (observation: Observation) : Promise<Consequences> {
        throw new Error('Cannot call possible() on empty action')
    }
}

export class CraftAction extends Action {

    itemId: number
    count: number
    allowWalking: boolean
    allowedMaxDistance?: number
    Recipe: any

    constructor(bot: Bot, mcData: IndexedData, itemId: number, count: number = 1, allowWalking: boolean = false, allowedMaxDistance: number = DEFAULT_ALLOWED_DISTANCE) {
        super(bot, mcData)
        this.itemId = itemId
        this.count = count
        this.allowWalking = allowWalking
        this.allowedMaxDistance = allowedMaxDistance
    }

    

    async do(): Promise<any> {
        let craftingTable = findBlock(this.bot, 
            this.mcData.blocksByName.crafting_table.id, 
            this.allowWalking ? this.allowedMaxDistance! : 6.0, 
            this.bot.entity.position)

        let recipes = this.bot.recipesFor(this.itemId, null, this.count, craftingTable)
        recipes = recipes.filter(x => !x.requiresTable || (x.requiresTable && craftingTable !== null))
        if (recipes.length === 0)
            throw new RecipeNotFoundError(this.itemId)

        await this.bot.craft(recipes[0], Math.ceil(this.count / recipes[0].result.count), craftingTable ?? undefined)
    }

    async possible(observation: Observation): Promise<Consequences> {
        let recipes = this.mcData.recipes[this.itemId]
        let craftingTable = findBlock(this.bot, 
                                      this.mcData.blocksByName.crafting_table.id, 
                                      this.allowWalking ? this.allowedMaxDistance! : 6.0, 
                                      observation.position)

        let recipe = recipes.map(x => parseRecipe(x)).find(x => {
            try{
                if (x.requiresTable && craftingTable === null) //
                    return false

                let c = Math.ceil(this.count / x.resultCount)
                for (const [id, count] of Object.entries(x.ingredients)) {
                    assertHas(observation, c * (count as number), id)
                }
            } catch (e) {
                if (e instanceof NotEnoughItemsError) return false
                else throw e 
            }
            return true
        })


        if (recipe === undefined)
            return { success: false }

        let c = Math.ceil(this.count / recipe.resultCount)
        let inv = Object.fromEntries(Object.entries(recipe.ingredients).map(([key, value]) => [key, -c * (value as number)]))
        inv[this.itemId] = c * recipe.resultCount

        return {
            success: true,
            inventory: inv
        }
    }
}

export class FindAndCollectAction extends Action {

    blockId: number
    amountToCollect: number
    allowedMaxDistance: number

    //TODO: Maybe we should check if the bot has the tools
    //      to mine the block type, and automatically equip 
    //      the best tool to mine it
    constructor(bot: Bot, mcData: IndexedData, blockId: number, amountToCollect: number, allowedMaxDistance: number) {
        super(bot, mcData)

        this.blockId = blockId
        this.amountToCollect = amountToCollect
        this.allowedMaxDistance = allowedMaxDistance
    }

    async do(): Promise<Record<number, number>> { // TODO: Do we need metadata?        
        let blockType = this.mcData.blocks[this.blockId]
        let blocksBefore: Record<number, number> = Object.fromEntries(blockType.drops.map(x => [x, this.bot.inventory.count(x as number, null)]))

        const blocks = findBlocks(this.bot, this.blockId, this.allowedMaxDistance, this.amountToCollect)

        if (blocks.length === 0) {
            throw new BlockNotFoundError(this.blockId)
        }

        const targets: Block[] = []
        for (let i = 0; i < Math.min(blocks.length, this.amountToCollect); i++) {
            let block = this.bot.blockAt(blocks[i])
            if (block)
                targets.push(block!)
        }

        //@ts-ignore  ts doesnt know about mineflayer plugins
        await this.bot.collectBlock.collect(targets)

        let blocksNow: Record<number, number> = Object.fromEntries(blockType.drops.map(x => [x, this.bot.inventory.count(x as number, null)]))

        return Object.fromEntries(Object.entries(blocksNow).map(([key, count]) => [key, count - blocksBefore[key]]))
    }

    async possible (observation: Observation): Promise<Consequences> {
        let blockType = this.mcData.blocks[this.blockId]

        // Now checking for harvest tools
        
        if (blockType.harvestTools !== undefined) {
            try{
                assertHas(observation, 1, (i => Object.keys(blockType.harvestTools!).includes(i as string)))
            } catch (e) {
                if (e instanceof NotEnoughItemsError){
                    return { success: false }
                } else throw e
            }
        }

        const blocks = findBlocks(this.bot, this.blockId, this.allowedMaxDistance, this.amountToCollect, observation.position)
        
        if (blocks.length < this.amountToCollect) {
            return { success: false }
        }

        let inv = Object.fromEntries(blockType.drops.map(x => [x, this.amountToCollect]))
        return {
            success: true,
            inventory: inv
        }
    }
}