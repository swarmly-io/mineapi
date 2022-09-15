import { IndexedData } from 'minecraft-data'
import { Bot } from 'mineflayer'
import  collectBlock from 'mineflayer-collectblock'
import { goals, pathfinder } from 'mineflayer-pathfinder'
import { Action, ActionParams } from './actions/Action.js'
import { FindAndCollectAction, FindAndCollectParams as FindAndCollectActionParams } from './actions/FindAndCollectResourceAction.js'
import { CraftAction, CraftActionParams } from './actions/CraftAction.js'
import { NotPossibleError } from './errors/NotPossibleError.js'
import { mergeWithConsequences, observe } from './Observer.js'
import { TravelAction } from './actions/TravelAction.js'
import { SleepAction } from './actions/SleepAction.js'

const DEFAULT_ALLOWED_DISTANCE = 16
export class Attributes {

    bot: Bot
    mcData: IndexedData
    actionOptions: ActionParams<any>

    constructor(bot, mcData) {
        this.bot = bot
        this.mcData = mcData
        this.actionOptions = { bot: bot, mcData: mcData }
        this.bot.loadPlugin(collectBlock.plugin)
        this.bot.loadPlugin(pathfinder)
    }

    async canDo(actions: Action<any>[]): Promise<true | number> { // Returns true when all actions are possible, otherwise the index of the failing action

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

    async tryDo(actions: Action<any>[]): Promise<any> {

        let result = await this.canDo(actions)
        if (true !== result) {
            throw new NotPossibleError()
        }

        for (let i = 0; i < actions.length; i++) {
            let action = actions[i]

            try {
                await action.do()
            } catch (e) {
                console.log(`Failed at task ${i}`)
                throw e
            }
        }
    }

    findAndCollectResource(params: FindAndCollectActionParams) {
        return new FindAndCollectAction({ ...this.actionOptions, ...params })
    }

    craft(params: CraftActionParams) {
        return new CraftAction({ ...this.actionOptions, ...params })        
    }

    // Crafting shortcuts
    craft_table = () => new CraftAction({ ...this.actionOptions, itemIds: this.mcData.itemsByName.crafting_table.id, count: 1 })
    craft_pickaxe = () => new CraftAction({ ...this.actionOptions, itemIds: this.mcData.itemsByName.wooden_pickaxe.id, count: 1 })
    craft_axe = () => new CraftAction({ ...this.actionOptions, itemIds: this.mcData.itemsByName.wooden_axe.id, count: 1 })

    collect_logs = (count: number, allowedMaxDistance = DEFAULT_ALLOWED_DISTANCE) => // will also allow 'striped_x_log', but i think it dosen't matter
        new FindAndCollectAction({ ...this.actionOptions,
                                   blockIds: this.mcData.blocksArray.filter(x => x.name.endsWith('_log')).map(x => x.id), 
                                   amountToCollect: count, 
                                   allowedMaxDistance: allowedMaxDistance })

    travel = (goal: goals.Goal) => new TravelAction({ ...this.actionOptions, goal: goal }) 

    go_sleep = () => new SleepAction({ ...this.actionOptions })
}