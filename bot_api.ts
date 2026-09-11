import mineflayer, { Bot } from "mineflayer"
import { Attributes } from "./Attributes";
import { MinecraftVersion } from "./Config";
import mcd from 'minecraft-data'
import { logger } from "./log";
import { v4 as uuidv4 } from 'uuid';
import { CraftAction, CraftActionParams } from "./actions/CraftAction";
import { FightAction, FightActionParams } from "./actions/FightAction";
import { FindAndCollectAction, FindAndCollectParams } from "./actions/FindAndCollectResourceAction";
import { PlaceAction, PlaceActionParams } from './actions/PlaceAction';
import { SleepAction, SleepActionParams } from "./actions/SleepAction";
import { TravelAction, TravelActionParams } from "./actions/TravelAction";
import { FailedChainResult } from "./types";
import { Action } from "./actions/Action";
import { BotActionState } from "./actions/BotActionState";
import { SmeltAction, SmeltActionParams } from "./actions/SmeltAction";
import { DepositAction, DepositActionParams } from "./actions/DepositAction";
import { WithdrawAction, WithdrawActionParams } from "./actions/WithdrawAction";
import { MineBlockAtAction, MineBlockAtParams } from "./actions/MineBlockAtAction";
import { observe, vec2key } from "./Observer";
import { Observation } from "./types";

let mcData = mcd(MinecraftVersion)

type ActionParams = CraftActionParams | FightActionParams | FindAndCollectParams | PlaceActionParams | SleepActionParams | TravelActionParams | SmeltActionParams | DepositActionParams | WithdrawActionParams | MineBlockAtParams

export interface CallbackInfo {
    typeName: 'CraftAction' | 'FightAction' | 'FindAndCollectAction' | 'PlaceAction' | 'SleepAction' | 'TravelAction' | 'SmeltAction' | 'DepositAction' | 'WithdrawAction' | 'MineBlockAtAction'
    params: ActionParams
    continueOnFailure: boolean
    callback?: Action<any>
}

export interface Task {
    id: string
    status: TaskStatus
    callbackChain: CallbackInfo[]
    startedAt?: number
    completedAt?: number
    result?: true | FailedChainResult
    before?: Observation
    after?: Observation
    worldDelta?: Record<number, number>
}

export type TaskStatus = 'accepted' | 'running' | 'succeeded' | 'failed' | 'cancelled'

class TaskRunner {
    tasks: { [id: string]: Task } = {}
    attributes: Attributes
    actionState: BotActionState;
    activeTaskId?: string

    constructor(attributes: Attributes) {
        this.attributes = attributes
        this.actionState = new BotActionState(this.attributes.bot)
    }

    async start(task: Task) {
        if (this.tasks[task.id]) {
            throw new Error("Task has already started!")
        }
        if (this.activeTaskId) {
            throw new Error("Another task is already running")
        }
        const unresolvedCallbacks = task.callbackChain.filter(x=> !x.callback)
        if (unresolvedCallbacks.length > 0) {
            throw new Error("Got some unresolved callbacks in task " + unresolvedCallbacks.length)
        }

        this.tasks[task.id] = task
        this.activeTaskId = task.id
        void this.execute(task)
        return task
    }

    private async execute(task: Task) {
        const worldDelta: Record<number, number> = {}
        const recordBlockChange = (_oldBlock: any, newBlock: any) => {
            if (newBlock?.position) worldDelta[vec2key(newBlock.position)] = newBlock.type
        }
        this.attributes.bot.on('blockUpdate', recordBlockChange)
        task.status = 'running'
        task.startedAt = Date.now()
        task.before = await observe(this.attributes.bot)
        try {
            const actions = task.callbackChain.map(x => {
                const Constructor = x.callback! as any
                const action = new Constructor({ ...this.attributes.actionOptions, ...x.params })
                this.actionState.startTask(action)
                return action
            })
            const result = await this.attributes.tryDo(actions)
            task.result = result
            task.status = this.isCancelled(task) ? 'cancelled' : result === true ? 'succeeded' : 'failed'
        } catch (error) {
            task.result = { index: -1, reason: error instanceof Error ? error.message : String(error) }
            task.status = this.isCancelled(task) ? 'cancelled' : 'failed'
        } finally {
            this.attributes.bot.removeListener('blockUpdate', recordBlockChange)
            this.actionState.stopTask()
            task.worldDelta = worldDelta
            task.after = await observe(this.attributes.bot)
            task.after.world = worldDelta
            task.completedAt = Date.now()
            this.activeTaskId = undefined
        }
    }

    get(taskId: string) {
        return this.tasks[taskId]
    }

    get currentTaskId() {
        return this.activeTaskId
    }

    private isCancelled(task: Task) {
        return task.status === 'cancelled'
    }

    async stop(taskId?: string) {
        const activeTask = this.activeTaskId ? this.tasks[this.activeTaskId] : undefined
        if (!activeTask || (taskId && activeTask.id !== taskId)) {
            throw new Error("No matching task is running")
        }
        activeTask.status = 'cancelled'
        this.attributes.bot.pathfinder.stop()
        this.attributes.bot.stopDigging()
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
        this.actions = [CraftAction, FightAction, FindAndCollectAction, MineBlockAtAction, PlaceAction, SleepAction, TravelAction, SmeltAction, DepositAction, WithdrawAction]
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
        return {
            taskId: this.taskRunner?.currentTaskId,
            state: await this.taskRunner?.actionState.get_action_state()
        }
    }

    async can_do(callbackChain: CallbackInfo[]) {
        const task = this.resolveTask(callbackChain)
        return this.attributes!.canDo(task.callbackChain.map(x => new (x.callback! as any)({ ...this.attributes!.actionOptions, ...x.params })))
    }

    async start_task(callbackChain: CallbackInfo[]) {
        const task = this.resolveTask(callbackChain)
        return this.taskRunner!.start(task)
    }

    private resolveTask(callbackChain: CallbackInfo[]) {
        for (let info of callbackChain) {
            const cons = this.actionsMap[info.typeName]
            if (!cons) {
                throw new Error("Couldn't find that action " + info.typeName)
            }
            info.callback = cons;
        }
        return { id: uuidv4(), status: 'accepted', callbackChain } as Task
    }

    get_task(taskId: string) {
        return this.taskRunner!.get(taskId)
    }

    chat(message: string) {
        this.bot.chat(message)
    }

    async stop(taskId?: string) {
        await this.taskRunner!.stop(taskId)
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