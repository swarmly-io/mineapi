import { FightActionParams } from './actions/FightAction';
import { TravelActionParams } from './actions/TravelAction';
import { BotService, CallbackInfo, InitBot } from './bot_api';
import { SearchData, searchMcData } from './helpers/McDataHelper';
import { createGoal, TravelGoal, Point } from './helpers/TravelHelper';
import { IndexedData } from 'minecraft-data';
import { FindAndCollectParams } from './actions/FindAndCollectResourceAction';

type ExampleType = "fight" | "travel" | "collect"
type ActionType = "chest" | "player" | "point" | undefined
type ResourceType = "stone" | "wood" | "iron" | "diamond" | undefined 
type TravelType = "chest" | "player" | "point" | undefined

export interface StartExample {
    init: InitBot
    type: ExampleType
    actionType: ActionType
    resourceType: ResourceType
    travelType: TravelType
}

export class Example {
    jim: BotService
    steve: BotService
    mcData: IndexedData
    actionType: ActionType
    resourceType: ResourceType
    travelType: TravelType
    type: ExampleType

    constructor(params: StartExample, mcData) {
        this.jim = new BotService(params.init.port, params.init.host, 'jim')
        this.steve = new BotService(params.init.port, params.init.host, 'steve')
        this.mcData = mcData
        this.type = params.type
        this.actionType = params.actionType
        this.resourceType = params.resourceType
        this.travelType = params.travelType
    }

    async run() {
        console.time("start")
        await new Promise( (resolve) => setTimeout(() => resolve(1), 5000))
        console.timeEnd("start")
        if (this.type == "fight") await this.fightBot()
        if (this.type == "travel") await this.travel()
        if (this.type == "collect") await this.collect_resources() 
    }

    async fightBot() {
        const fightParams = { entityName: 'steve', entityType: 'player' } as FightActionParams
        const callbackChain = [{ typeName: 'FightAction', params: fightParams } as CallbackInfo]
        const possible = await this.jim.start_task(callbackChain, true)
        console.log("Fighting possible", possible)
        if (possible) {
            this.jim.bot.chat("Fighting steve!")
            await this.jim.start_task(callbackChain)
        } else {
            this.jim.bot.chat("No steve to fight!?")
        }
    }

    async travel() {
        if (this.travelType == 'point') {
           const state = await this.steve.get_agent_state()
           const entity = state.closeEntities[0]
           const goal = createGoal({ type: 'point', value: { ...entity.position } as Point } as TravelGoal)
           const travelParams = { goal } as TravelActionParams
           const callbackChain = [{ typeName: 'TravelAction', params: travelParams } as CallbackInfo]
           const possible = await this.jim.start_task(callbackChain, true)
           if (possible) {
            this.jim.bot.chat("Travelling")
            this.jim.start_task(callbackChain)
           } else {
               this.jim.bot.chat("No travelling!?")
           }
        }
    }

    build() {
        // todo 
    }

    async collect_resources() {
        const term = { "stone": "stone", "wood": "_log", "iron": "iron_ore", "diamond": "diamond_ore" }
        
        const params = { term: term[this.resourceType!], endsWith: this.resourceType == 'stone' ? false : true } as SearchData

       const resources = searchMcData(this.mcData, params).map(x=> x.id)
       const actionParams = { blockIds: resources, amountToCollect: 1, allowedMaxDistance: 50 } as FindAndCollectParams
       const callbackChain = [{ typeName: 'FindAndCollectResourceAction', params: actionParams } as CallbackInfo]
       const possible = await this.jim.start_task(callbackChain, true)
       if (possible) {
            this.jim.bot.chat("Collecting " + this.resourceType)
            this.jim.start_task(callbackChain, true)
            
       } else {
            this.jim.bot.chat("Couldn't collect " + this.resourceType)
       }
    }
}
