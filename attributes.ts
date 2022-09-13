import { IndexedData } from 'minecraft-data'
import { Bot } from 'mineflayer'
import  collectBlock from 'mineflayer-collectblock'
import { pathfinder } from 'mineflayer-pathfinder'
import { CraftAction, FindAndCollectAction } from './action'

const DEFAULT_ALLOWED_DISTANCE = 16
export class Attributes {

    bot: Bot
    mcData: IndexedData

    constructor(bot, mcData) {
        this.bot = bot
        this.mcData = mcData
        this.bot.loadPlugin(collectBlock.plugin)
        this.bot.loadPlugin(pathfinder)
    }

    async findAndCollectResource(blockId: number, amountToMine: number, allowedMaxDistance = DEFAULT_ALLOWED_DISTANCE) {
        return new FindAndCollectAction(this.bot, this.mcData, blockId, amountToMine, allowedMaxDistance)
    }

    craft(itemId: number, count: number, allowWalking = false, allowedMaxDistance = DEFAULT_ALLOWED_DISTANCE) {
        return new CraftAction(this.bot, this.mcData, itemId, count, allowWalking, allowedMaxDistance)        
    }

    // Crafting shortcuts
    craft_table = () => new CraftAction(this.bot, this.mcData, this.mcData.itemsByName.crafting_table.id, 1)
    craft_pickaxe = () => new CraftAction(this.bot, this.mcData, this.mcData.itemsByName.wooden_pickaxe.id, 1)
    craft_axe = () => new CraftAction(this.bot, this.mcData, this.mcData.itemsByName.wooden_axe.id, 1)
}