import mineflayer, { Bot } from "mineflayer"
import { Attributes } from "./Attributes";
import { MinecraftVersion } from "./Config";
import mcd from 'minecraft-data'
import { logger } from "./log";
import { v4 as uuidv4, v4 } from 'uuid';
import { CraftAction, CraftActionParams } from "./actions/CraftAction";
import { FightAction, FightActionParams } from "./actions/FightAction";
import { FindAndCollectAction, FindAndCollectParams } from "./actions/FindAndCollectResourceAction";
import { PlaceAction, PlaceActionParams } from './actions/PlaceAction';
import { SleepAction, SleepActionParams } from "./actions/SleepAction";
import { TravelAction, TravelActionParams } from "./actions/TravelAction";
import { observe } from "./Observer";
import { FailedChainResult } from "./types";
import { Action } from "./actions/Action";
import { BotActionState } from "./actions/BotActionState";
import { SmeltAction, SmeltActionParams } from "./actions/SmeltAction";
import { DepositAction, DepositActionParams } from "./actions/DepositAction";
import { WithdrawActionParams } from "./actions/WithdrawAction";

let mcData = mcd(MinecraftVersion)

type ActionParams = CraftActionParams | FightActionParams | FindAndCollectParams | PlaceActionParams | SleepActionParams | TravelActionParams | SmeltActionParams | DepositActionParams | WithdrawActionParams

export interface CallbackInfo {
    typeName: 'CraftAction' | 'FightAction' | 'FindAndCollectAction' | 'PlaceAction' | 'SleepAction' | 'TravelAction' | 'SmeltAction' | 'DepositAction' | 'WithdrawAction'
    params: ActionParams
    continueOnFailure: boolean
    callback?: Action<any>
}

export interface Task {
    id: string
    status?: true | FailedChainResult
    message?: string
    callbackChain: CallbackInfo[]
}

class TaskRunner {
    tasks: { [id: string]: Task } = {}
    attributes: Attributes
    actionState: BotActionState;

    constructor(attributes: Attributes) {
        this.attributes = attributes
        this.actionState = new BotActionState(this.attributes.bot)
    }

    async start(task: Task, isPossible: boolean = false) {
        if (this.tasks[task.id]) {
            throw new Error("Task has already started!")
        }
        const unresolvedCallbacks = task.callbackChain.filter(x=> !x.callback)
        if (unresolvedCallbacks.length > 0) {
            throw new Error("Got some unresolved callbacks in task " + unresolvedCallbacks.length)
        }

        this.tasks[task.id] = task

        if (isPossible) {
            return await this.attributes.canDo(task.callbackChain.map(x=> {
                const cons = x.callback! as any;
                const params = { ...this.attributes.actionOptions, ...x.params }
                return new cons(params)
            }))
        } else {
            const result = await this.attributes.tryDo(task.callbackChain.map(x=> {
                const cons = x.callback! as any;
                const params = { ...this.attributes.actionOptions, ...x.params }
                const action = new cons(params)
                this.actionState.startTask(action)
                return action
            }))
            this.actionState.stopTask();
            return result;
        }
    }

    async stop(task: Task) {
        // todo
    }

    async status(task: Task) {
        // todo
    }
}

export interface InitBot {
    port: string
    host: string
    name: string
}

export class BotService {
    port: number = 0
    host: string = "host.docker.internal"
    name: string = "McBot"

    bot: Bot
    attributes: Attributes | null = null
    id: any
    actions: any[] = []
    actionsMap: { [name: string]: Action<any> } = {}
    taskRunner? : TaskRunner
    errors: any[] = []

    constructor(port, host, name) {
        // port, host etc
        this.port = port || this.port
        this.host = host || this.host
        this.name = name || this.name
        this.bot = mineflayer.createBot({
            // host: process.argv[0],
             host: host,
             port: port as number,
             username: name,
           //  username: process.argv[4] ? process.argv[4] : "finder",
           //  password: process.argv[5],
        });
        this.attributes = new Attributes(this.bot, mcData, logger)
        this.id = uuidv4()
        this.actions = [CraftAction, FightAction, FindAndCollectAction, PlaceAction, SleepAction, TravelAction, SmeltAction, DepositAction]
        this.actionsMap = Object.assign({}, ...this.actions.map(x=> ({ [x.name]: x })))
        this.taskRunner = new TaskRunner(this.attributes)

        this.bot.on('error', err => {
            console.log(err)
            this.errors.push(err)
        })
    }

    get_actions() {
        return this.actions.map(x=> x.name)
    }

    async get_agent_state() {
        return await observe(this.bot)
    }

    async get_action_state() {
        return await this.taskRunner?.actionState.get_action_state()
    }

    async start_task(callbackChain: CallbackInfo[], isPossible: boolean = false) {
        for (let info of callbackChain) {
            const cons = this.actionsMap[info.typeName]
            if (!cons) {
                throw new Error("Couldn't find that action " + info.typeName)
            }
            info.callback = cons;
        }
        let task = { id: v4(), callbackChain: callbackChain } as Task
        
        return this.taskRunner!.start(task, isPossible)
    }

    chat(message: string) {
        this.bot.chat(message)
    }

    async stop() {
        this.bot.pathfinder.stop()
        this.bot.stopDigging()
        this.bot.chat("Have stopped for now")
    }

    reset() {
        try {
            this.bot.quit()
        } catch(e) {
            console.log(e)
        }
        this.attributes = null;
        return new BotService(this.port, this.host, this.name)
    }
}