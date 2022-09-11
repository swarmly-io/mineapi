import  collectBlock from 'mineflayer-collectblock'
import pathfinder from 'mineflayer-pathfinder'
import { BlockNotFoundError } from './errors/BlockNotFoundError.js'
import { assertHas } from './helpers/InventoryHelper.js'

const { goals } = pathfinder

const DEFAULT_ALLOWED_DISTANCE = 16
export class Attributes {
    constructor(bot, mcData) {
        this.bot = bot
        this.mcData = mcData
        this.bot.loadPlugin(collectBlock.plugin)
    }

    async findAndCollectResource(blockId, amountToMine, allowedMaxDistance = DEFAULT_ALLOWED_DISTANCE) {
        //TODO: Maybe we should check if the bot has the tools
        //      to mine the block type, and automatically equip 
        //      the best tool to mine it

        let blocksBefore = this.bot.inventory.count(blockId)

        const blocks = this.bot.findBlocks({
            matching: blockId,
            count: amountToMine,
            allowedMaxDistance: allowedMaxDistance
        })

        if (blocks.length === 0) {
            throw new BlockNotFoundError(blockId)
        }

        const targets = []
        for (let i = 0; i < Math.min(blocks.length, count); i++) {
            targets.push(this.bot.blockAt(blocks[i]))
        }

        await this.bot.collectBlock.collect(targets)

        return this.bot.inventory.count(blockId) - blocksBefore
    }

    async craft_table() {
        assertHas(this.bot, 5, (item) => item.name.endsWith('planks'))

        let recipe = this.bot.recipeFor(this.mcData.blocksByName.crafting_table.id, null, 1)
        await this.bot.craft(recipe, 1)

        // todo place crafting table
        return true
    }

    // todo crafting axe and crafting pick axe are very similar combine these.
    async crafting_pickaxe(allowWalking = false, allowedMaxDistance = DEFAULT_ALLOWED_DISTANCE) {
        // TODO: Currently this will only craft wood pickaxes

        let craftingTable = this.bot.findBlock({
            matching: this.mcData.blocksByName.crafting_table.id,
            maxDistance: allowWalking ? allowedMaxDistance : 6.0,
        })

        if (craftingTable === null) {
            throw new BlockNotFoundError(this.mcData.blocksByName.crafting_table.id)
        }

        // todo move this below the recipe, then assert on the recipe
        // assert we have the materials to craft a pickaxe (2 sticks and 3 planks)
        assertHas(this.bot, 2, this.mcData.itemsByName.stick.id)
        assertHas(this.bot, 3, (item) => item.name.endsWith('planks'))

        if (36.0 >= craftingTable.position.distanceSquared(this.bot.entity.position)) {
            // crafting table is out of reach
            // the bot has to move there

            await this.bot.pathfinder.goto(new goals.GoalNear(
                craftingTable.position.x,
                craftingTable.position.y,
                craftingTable.position.z,
                6.0))
        }

        let recipe = this.bot.recipeFor(this.mcData.recipes.wooden_pickaxe.id, null, 1, craftingTable)
        await this.bot.craft(recipe, 1, craftingTable)
        return true
    }

    async crafting_axe(allowWalking = false, allowedMaxDistance = DEFAULT_ALLOWED_DISTANCE) {
        // TODO: Currently this will only craft wood axes

        let craftingTable = this.bot.findBlock({
            matching: this.mcData.blocksByName.crafting_table.id,
            maxDistance: allowWalking ? allowedMaxDistance : 6.0,
        })

        if (craftingTable === null) {
            throw new BlockNotFoundError(this.mcData.blocksByName.crafting_table.id)
        }

        // assert we have the materials to craft an axe (2 sticks and 3 planks)
        assertHas(this.bot, 2, this.mcData.itemsByName.stick.id)
        assertHas(this.bot, 3, (item) => item.name.endsWith('planks'))

        if (36.0 >= craftingTable.position.distanceSquared(this.bot.entity.position)) {
            // crafting table is out of reach
            // the bot has to move there

            await this.bot.pathfinder.goto(new goals.GoalNear(
                craftingTable.position.x,
                craftingTable.position.y,
                craftingTable.position.z,
                6.0))
        }

        let recipe = this.bot.recipeFor(this.mcData.recipes.wooden_axe.id, null, 1, craftingTable)
        await this.bot.craft(recipe, 1, craftingTable)
        return true
    }
}