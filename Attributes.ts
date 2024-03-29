import { IndexedData } from 'minecraft-data'
import { Bot } from 'mineflayer'
import { goals, pathfinder } from 'mineflayer-pathfinder'
import { Action, ActionParams } from './actions/Action'
import { FindAndCollectAction, FindAndCollectParams as FindAndCollectActionParams } from './actions/FindAndCollectResourceAction'
import { CraftAction, CraftActionParams } from './actions/CraftAction'
import { mergeWithConsequences, observe, prettyConsequences, prettyObservation } from './Observer'
import { TravelAction } from './actions/TravelAction'
import { SleepAction } from './actions/SleepAction'
import { PlaceAction, PlaceActionParams } from './actions/PlaceAction'
import { FailedChainResult } from './types'
import { Logger } from 'tslog'
import { plugin as collectBlock } from 'mineflayer-collectblock'
import { plugin as pvp } from 'mineflayer-pvp'
import { plugin as tool } from 'mineflayer-tool'
import { FightAction, FightActionParams } from './actions/FightAction'
import { BuildSchematicAction, BuildSchematicParams } from './actions/BuildSchematicAction'

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const DEFAULT_ALLOWED_DISTANCE = 16
export class Attributes {

    bot: Bot
    mcData: IndexedData
    actionOptions: ActionParams<any>
    logger: Logger

    constructor(bot: Bot, mcData: IndexedData, logger: Logger) {
        this.bot = bot
        this.mcData = mcData
        this.actionOptions = { bot: bot, mcData: mcData }
        this.logger = logger
        this.bot.loadPlugin(collectBlock)
        this.bot.loadPlugin(pathfinder)
        this.bot.loadPlugin(pvp)
        this.bot.loadPlugin(tool)
    }

    // Returns true when all actions are possible, otherwise the index of the failing action
    async canDo(actions: Action<any>[]): Promise<true | FailedChainResult> { 

        this.logger.debug(`Testing chain: [${actions.map(x => x.constructor.name)}]`)   
        let observation = await observe(this.bot)
        for (let i = 0; i < actions.length; i++) {
            let action = actions[i]           
            this.logger.debug(`Testing action ${i} (${action.constructor.name})`, { params: action.options, observation: prettyObservation(observation, this.mcData) })

            let result = await action.possible(observation)
            if (!result.success) {
                this.logger.warn(`Chain not possible. Action ${i} (${action.constructor.name}) failed: '${result.reason}'`)
                return {
                    index: i,
                    reason: result.reason
                }
            }
            this.logger.debug(`Action ${i} (${action.constructor.name}) possible`, { result: prettyConsequences(result, this.mcData), observation: observation })
            //merge the consequences of previous action with the consequences
            observation = mergeWithConsequences(observation, result)
        }

        this.logger.debug(`Chain is possible.`, { endState: prettyObservation(observation, this.mcData) })

        return true
    }

    async tryDo(actions: Action<any>[]): Promise<true | FailedChainResult> {

        this.logger.debug(`Trying to do chain: [${actions.map(x => x.constructor.name)}]`)
        let result = await this.canDo(actions)
        if (true !== result) {
            this.logger.error(`Chain not possible`, {result: result})
            return result
        }

        for (let i = 0; i < actions.length; i++) {
            let action = actions[i]
            this.logger.debug(`Executing action ${i} (${action.constructor.name})`, {params: action.options})
            let actionResult = await action.do() 
            if (true !== actionResult) {
                this.logger.error(`Action ${i} (${action.constructor.name}) failed`, {result: actionResult}, { currentEnv: prettyObservation(await observe(this.bot), this.mcData) })
                return {
                    index: i,
                    reason: `${actionResult.reason}`
                }
            }
            await sleep(500) // TODO: Maybe don't pause after every action, but only when needed (f.e. collected items from findAndCollect action may not be in the inventory yet.)
        }

        return true
    }

    findAndCollectResource(params: FindAndCollectActionParams) {
        return new FindAndCollectAction({ ...this.actionOptions, ...params })
    }

    craft(params: CraftActionParams) {
        return new CraftAction({ ...this.actionOptions, ...params })        
    }

    place(params: PlaceActionParams) {
        return new PlaceAction({ ...this.actionOptions, ...params })
    }

    fight(params: FightActionParams) {
        return new FightAction({ ...this.actionOptions, ...params })
    }

    build_schematic(params: BuildSchematicParams) {
        return new BuildSchematicAction({ ...this.actionOptions, ...params })
    }

    // Crafting shortcuts
    craft_table = () => new CraftAction({ ...this.actionOptions, itemIds: this.mcData.itemsByName.crafting_table.id, count: 1 })
    place_table = () => new PlaceAction({ ...this.actionOptions, itemId: this.mcData.itemsByName.crafting_table.id })
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