import { IndexedData } from 'minecraft-data'
import { Bot } from 'mineflayer'
import  collectBlock from 'mineflayer-collectblock'
import { pathfinder } from 'mineflayer-pathfinder'
import { Action, CraftAction, FindAndCollectAction } from './action'
import { mergeWithConsequences, observe } from './observer'

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

    async canDo(actions: Action[]): Promise<boolean | number> { // Returns true when all actions are possible, otherwise the index of the failing action

        let observation = await observe(this.bot)

        for (let i = 0; i < actions.length; i++) {
            let action = actions[i]           

            let result = await action.possible(observation)
            if (!result.success) {
                return i
            }

            //merge the consequences of previous action with the consequences
            observation = mergeWithConsequences(observation, result)
        }

        return true
    }

    findAndCollectResource(blockId: number, amountToMine: number, allowedMaxDistance = DEFAULT_ALLOWED_DISTANCE) {
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