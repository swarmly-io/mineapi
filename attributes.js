import  collectBlock from 'mineflayer-collectblock'
import pathfinder from 'mineflayer-pathfinder'
import { CraftAction, FindAndCollectAction } from './Action'

const DEFAULT_ALLOWED_DISTANCE = 16
export class Attributes {
    constructor(bot, mcData) {
        this.bot = bot
        this.mcData = mcData
        this.bot.loadPlugin(collectBlock.plugin)
    }

    async findAndCollectResource(blockId, amountToMine, allowedMaxDistance = DEFAULT_ALLOWED_DISTANCE) {
        return new FindAndCollectAction(this.bot, this.mcData, blockId, amountToMine, allowedMaxDistance)
    }

    craft(itemId, count, allowWalking = false, allowedMaxDistance = DEFAULT_ALLOWED_DISTANCE) {
        return new CraftAction(this.bot, this.mcData, itemId, count, allowWalking, allowedMaxDistance)        
    }

    // Crafting shortcuts
    craft_table = () => new CraftAction(this.bot, this.mcData, this.mcData.itemsByName.crafting_table.id, 1)
    craft_pickaxe = () => new CraftAction(this.bot, this.mcData, this.mcData.itemsByName.wooden_pickaxe, 1)
    craft_axe = () => new CraftAction(this.bot, this.mcData, this.mcData.itemsByName.wooden_axe, 1)
}