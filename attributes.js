
const collectBlock = require('mineflayer-collectblock').plugin
const { pathfinder, goals } = require('mineflayer-pathfinder')
const BlockNotFoundError = require('./errors/BlockNotFoundError')
const InventoryHelper = require('./helpers/InventoryHelper')


const DEFAULT_ALLOWED_DISTANCE = 16

module.exports = function(bot, mcData) {

    bot.loadPlugin(collectBlock)
    bot.loadPlugin()

    return {

        
        mining: async (blockId, amountToMine, allowedMaxDistance = DEFAULT_ALLOWED_DISTANCE) => {

            //TODO: Maybe we should check if the bot has the tools
            //      to mine the block type, and automatically equip 
            //      the best tool to mine it

            let blocksBefore = bot.inventory.count(blockId)

            const blocks = bot.findBlocks({
                matching: blockId,
                count: amountToMine,
                allowedMaxDistance: allowedMaxDistance
            })

            if (blocks.length === 0){
                throw new BlockNotFoundError(blockId)
            }

            const targets = []
            for (let i = 0; i < Math.min(blocks.length, count); i++) {
              targets.push(bot.blockAt(blocks[i]))
            }

            await bot.collectBlock.collect(targets)

            return bot.inventory.count(blockId) - blocksBefore
        },

        crafting_pickaxe: async (allowWalking = false, allowedMaxDistance = DEFAULT_ALLOWED_DISTANCE) => {
            // TODO: Currently this will only craft wood pickaxes

            let craftingTable = bot.findBlock({
                matching: mcData.blocksByName.crafting_table.id,
                maxDistance: allowWalking ? allowedMaxDistance : 6.0,
            })

            if (craftingTable === null) {
                throw new BlockNotFoundError(mcData.blocksByName.crafting_table.id)
            }

            // assert we have the materials to craft a pickaxe (2 sticks and 3 planks)
            InventoryHelper.assertHas(bot, 2, mcData.itemsByName.stick.id)
            InventoryHelper.assertHas(bot, 3, (item) => item.name.endsWith('planks')) 

            if (36.0 >= craftingTable.position.distanceSquared(bot.entity.position)) {
                // crafting table is out of reach
                // the bot has to move there

                await bot.pathfinder.goto(new goals.GoalNear(
                                            craftingTable.position.x, 
                                            craftingTable.position.y, 
                                            craftingTable.position.z, 
                                            6.0))                
            }

            let recipe = bot.recipeFor(mcData.recipes.wooden_pickaxe.id, null, 1, craftingTable)
            await bot.craft(recipe, 1, craftingTable)
            return true
        },
        
        crafting_axe: async (allowWalking = false, allowedMaxDistance = DEFAULT_ALLOWED_DISTANCE) => {
            // TODO: Currently this will only craft wood axes

            let craftingTable = bot.findBlock({
                matching: mcData.blocksByName.crafting_table.id,
                maxDistance: allowWalking ? allowedMaxDistance : 6.0,
            })

            if (craftingTable === null) {
                throw new BlockNotFoundError(mcData.blocksByName.crafting_table.id)
            }

            // assert we have the materials to craft an axe (2 sticks and 3 planks)
            InventoryHelper.assertHas(bot, 2, mcData.itemsByName.stick.id)
            InventoryHelper.assertHas(bot, 3, (item) => item.name.endsWith('planks')) 

            if (36.0 >= craftingTable.position.distanceSquared(bot.entity.position)) {
                // crafting table is out of reach
                // the bot has to move there

                await bot.pathfinder.goto(new goals.GoalNear(
                                            craftingTable.position.x, 
                                            craftingTable.position.y, 
                                            craftingTable.position.z, 
                                            6.0))                
            }

            let recipe = bot.recipeFor(mcData.recipes.wooden_axe.id, null, 1, craftingTable)
            await bot.craft(recipe, 1, craftingTable)
            return true
        },
    }

}