import mineflayer, { Bot } from "mineflayer"
import { Attributes } from "./Attributes"
import { MinecraftVersion } from "./Config"
import mcd from 'minecraft-data'
import { logger } from "./log"
import { v4 as uuidv4 } from 'uuid'
import { CraftAction, CraftActionParams } from "./actions/CraftAction"
import { FightAction, FightActionParams } from "./actions/FightAction"
import { FindAndCollectAction, FindAndCollectParams } from "./actions/FindAndCollectResourceAction"
import { PlaceAction, PlaceActionParams } from './actions/PlaceAction'
import { SleepAction, SleepActionParams } from "./actions/SleepAction"
import { TravelAction, TravelActionParams } from "./actions/TravelAction"
import { FailedChainResult, Observation } from "./types"
import { Action } from "./actions/Action"
import { BotActionState } from "./actions/BotActionState"
import { SmeltAction, SmeltActionParams } from "./actions/SmeltAction"
import { DepositAction, DepositActionParams } from "./actions/DepositAction"
import { WithdrawAction, WithdrawActionParams } from "./actions/WithdrawAction"
import { MineBlockAtAction, MineBlockAtParams } from "./actions/MineBlockAtAction"
import { observe, vec2key } from "./Observer"

const mcData = mcd(MinecraftVersion)
type ActionParams = CraftActionParams | FightActionParams | FindAndCollectParams | PlaceActionParams | SleepActionParams | TravelActionParams | SmeltActionParams | DepositActionParams | WithdrawActionParams | MineBlockAtParams
export type TaskStatus = 'accepted' | 'preflight_failed' | 'running' | 'succeeded' | 'partial' | 'failed' | 'cancelled' | 'timed_out' | 'unknown'
export interface CallbackInfo { typeName: 'CraftAction' | 'FightAction' | 'FindAndCollectAction' | 'PlaceAction' | 'SleepAction' | 'TravelAction' | 'SmeltAction' | 'DepositAction' | 'WithdrawAction' | 'MineBlockAtAction'; params: ActionParams; continueOnFailure?: boolean; callback?: Action<any> }
export interface TaskEnvelope { action_id: string; capability_id: string; plan_id?: string; entity_id?: string; timeout_ms?: number; action_chain: CallbackInfo[] }
export interface Task {
    id: string; action_id: string; capability_id?: string; plan_id?: string; entity_id?: string; timeout_ms?: number
    status: TaskStatus; callbackChain: CallbackInfo[]; created_at: string; started_at?: string; completed_at?: string
    current_chain_step?: number; retries: number; terminal_reason?: string; result?: true | FailedChainResult
    before?: Observation; after?: Observation; worldDelta?: Record<number, number>; outcome?: Record<string, unknown>
}
export type TaskEvent = { type: 'task.accepted' | 'task.progress' | 'task.completed' | 'observation.changed' | 'bot.error' | 'bot.disconnected'; action_id?: string; task_id?: string; timestamp: string; observation_version?: number; data?: unknown }

class TaskRunner {
    tasks: Record<string, Task> = {}; actionIds: Record<string, string> = {}; activeTaskId?: string
    actionState: BotActionState
    constructor(private attributes: Attributes, private takeObservation: () => Promise<Observation>, private emit: (event: TaskEvent) => void) { this.actionState = new BotActionState(attributes.bot) }
    async start(task: Task) {
        const prior = this.actionIds[task.action_id]
        if (prior) return this.tasks[prior]
        if (this.activeTaskId) throw new Error("Another task is already running")
        this.tasks[task.id] = task; this.actionIds[task.action_id] = task.id; this.activeTaskId = task.id
        this.emit({ type: 'task.accepted', action_id: task.action_id, task_id: task.id, timestamp: new Date().toISOString() })
        void this.execute(task); return task
    }
    private async execute(task: Task) {
        const worldDelta: Record<number, number> = {}
        const actionDetails: unknown[] = []
        const changed = (_oldBlock: any, newBlock: any) => { if (newBlock?.position) worldDelta[vec2key(newBlock.position)] = newBlock.type }
        const timeout = task.timeout_ms ? setTimeout(() => { task.status = 'timed_out'; task.terminal_reason = 'Task timed out'; this.stop(task.id).catch(() => undefined) }, task.timeout_ms) : undefined
        this.attributes.bot.on('blockUpdate', changed); task.status = 'running'; task.started_at = new Date().toISOString(); task.before = await this.takeObservation()
        try {
            const actions = task.callbackChain.map(info => new (info.callback! as any)({ ...this.attributes.actionOptions, ...info.params }))
            const preflight = await this.attributes.canDo(actions)
            if (preflight !== true) { task.status = 'preflight_failed'; task.result = preflight; task.terminal_reason = preflight.reason; return }
            for (let i = 0; i < actions.length; i++) {
                if ((task.status as TaskStatus) === 'cancelled' || (task.status as TaskStatus) === 'timed_out') break
                task.current_chain_step = i
                this.actionState.startTask(actions[i])
                this.emit({ type: 'task.progress', action_id: task.action_id, task_id: task.id, timestamp: new Date().toISOString(), data: { current_chain_step: i } })
                const result = await actions[i].do()
                actionDetails[i] = (actions[i] as any).lastOutcome
                if (result !== true) {
                    task.result = { index: i, reason: result.reason }; task.terminal_reason = result.reason
                    if (!task.callbackChain[i].continueOnFailure) break
                }
            }
            if (task.status === 'running') task.status = task.result ? 'failed' : 'succeeded'
        } catch (error) {
            task.result = { index: task.current_chain_step ?? -1, reason: error instanceof Error ? error.message : String(error) }; task.terminal_reason = task.result.reason
            if (task.status === 'running') task.status = 'failed'
        } finally {
            if (timeout) clearTimeout(timeout)
            this.attributes.bot.removeListener('blockUpdate', changed); this.actionState.stopTask()
            task.worldDelta = worldDelta; task.after = await this.takeObservation(); task.after.world = worldDelta
            const inventoryDelta = delta(task.before?.inventory.items ?? {}, task.after.inventory.items)
            const changedAnything = Object.keys(worldDelta).length > 0 || Object.values(inventoryDelta).some(value => value !== 0)
            if (task.status === 'failed' && changedAnything) task.status = 'partial'
            task.completed_at = new Date().toISOString(); this.activeTaskId = undefined
            const failedResult = task.result === true ? undefined : task.result
            task.outcome = { action_id: task.action_id, inventory_delta: inventoryDelta, world_delta: worldDelta, position_delta: positionDelta(task.before, task.after), status_delta: statusDelta(task.before, task.after), action_trace: task.callbackChain.map((step, index) => ({ index, action: step.typeName, completed: !failedResult || index < failedResult.index, reason: failedResult?.index === index ? failedResult.reason : undefined, details: actionDetails[index] })), partial_completion_count: task.status === 'partial' ? Object.keys(worldDelta).length : 0 }
            this.emit({ type: 'observation.changed', action_id: task.action_id, task_id: task.id, timestamp: new Date().toISOString(), observation_version: task.after.version })
            this.emit({ type: 'task.completed', action_id: task.action_id, task_id: task.id, timestamp: new Date().toISOString(), observation_version: task.after.version, data: task })
        }
    }
    get(taskId: string) { return this.tasks[taskId] }
    get currentTaskId() { return this.activeTaskId }
    async stop(taskId?: string) { const task = this.activeTaskId ? this.tasks[this.activeTaskId] : undefined; if (!task || (taskId && task.id !== taskId)) throw new Error("No matching task is running"); if (task.status !== 'timed_out') task.status = 'cancelled'; this.attributes.bot.pathfinder.stop(); this.attributes.bot.stopDigging() }
    disconnect() { if (this.activeTaskId) { const task = this.tasks[this.activeTaskId]; task.status = 'timed_out'; task.terminal_reason = 'Bot disconnected' } }
}
const delta = (before: Record<string, number>, after: Record<string, number>) => Object.fromEntries([...new Set([...Object.keys(before), ...Object.keys(after)])].map(key => [key, (after[key] ?? 0) - (before[key] ?? 0)]).filter(([, value]) => value !== 0))
const positionDelta = (before?: Observation, after?: Observation) => !before || !after ? undefined : { x: after.position.x - before.position.x, y: after.position.y - before.position.y, z: after.position.z - before.position.z }
const statusDelta = (before?: Observation, after?: Observation) => !before || !after ? undefined : Object.fromEntries(['health', 'food', 'saturation', 'oxygen'].map(key => [key, (after.status as any)[key] - (before.status as any)[key]]))
export interface InitBot { port: string; host: string; name: string }
export class BotService {
    bot: Bot; attributes: Attributes; id = uuidv4(); actions: any[]; actionsMap: Record<string, any>; taskRunner: TaskRunner; errors: any[] = []; observations: Observation[] = []; events: TaskEvent[] = []; private listeners = new Set<(event: TaskEvent) => void>()
    constructor(public port: any = 0, public host: string = "host.docker.internal", public name: string = "McBot") {
        this.bot = mineflayer.createBot({ host, port, username: name }); this.attributes = new Attributes(this.bot, mcData, logger)
        this.actions = [CraftAction, FightAction, FindAndCollectAction, MineBlockAtAction, PlaceAction, SleepAction, TravelAction, SmeltAction, DepositAction, WithdrawAction]; this.actionsMap = Object.fromEntries(this.actions.map(action => [action.name, action]))
        this.taskRunner = new TaskRunner(this.attributes, () => this.captureObservation(), event => this.emit(event))
        this.bot.on('error', error => { this.errors.push(error); this.emit({ type: 'bot.error', timestamp: new Date().toISOString(), data: String(error) }) })
        this.bot.on('end', () => { this.taskRunner.disconnect(); this.emit({ type: 'bot.disconnected', timestamp: new Date().toISOString() }) })
    }
    private async captureObservation() { const observation = await observe(this.bot); observation.observation_id = uuidv4(); observation.version = (this.observations.at(-1)?.version ?? 0) + 1; observation.timestamp = new Date().toISOString(); observation.bot_id = this.id; this.observations.push(observation); return observation }
    private emit(event: TaskEvent) { this.events.push(event); this.listeners.forEach(listener => listener(event)) }
    subscribe(listener: (event: TaskEvent) => void) { this.listeners.add(listener); return () => this.listeners.delete(listener) }
    get_actions() { return this.actions.map(action => action.name) }
    async get_agent_state() { return this.captureObservation() }
    get_observations(sinceVersion?: number) { return sinceVersion === undefined ? this.observations : this.observations.filter(observation => (observation.version ?? 0) > sinceVersion) }
    async get_action_state() { return { taskId: this.taskRunner.currentTaskId, state: await this.taskRunner.actionState.get_action_state() } }
    async can_do(callbackChain: CallbackInfo[]) { const task = this.resolveTask(callbackChain); return this.attributes.canDo(task.callbackChain.map(info => new (info.callback! as any)({ ...this.attributes.actionOptions, ...info.params }))) }
    async preflight(callbackChain: CallbackInfo[]) { const observation = await this.captureObservation(); const result = await this.can_do(callbackChain); return { feasible: result === true, blockers: result === true ? [] : [result.reason], matching_target_blocks: [], missing_tools_materials: result === true ? [] : [result.reason], inventory_capacity: observation.inventory.emptySlots, estimated_route_distance: null, observation_version: observation.version } }
    async start_envelope(envelope: TaskEnvelope) { if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(envelope.action_id)) throw new Error('action_id must be a UUID'); const task = this.resolveTask(envelope.action_chain, envelope); return this.taskRunner.start(task) }
    async start_task(callbackChain: CallbackInfo[]) { return this.taskRunner.start(this.resolveTask(callbackChain)) }
    private resolveTask(callbackChain: CallbackInfo[], envelope?: Partial<TaskEnvelope>): Task { const chain = callbackChain.map(info => ({ ...info, callback: this.actionsMap[info.typeName] })); for (const info of chain) if (!info.callback) throw new Error("Couldn't find that action " + info.typeName); return { id: uuidv4(), action_id: envelope?.action_id ?? uuidv4(), capability_id: envelope?.capability_id, plan_id: envelope?.plan_id, entity_id: envelope?.entity_id, timeout_ms: envelope?.timeout_ms, status: 'accepted', callbackChain: chain, created_at: new Date().toISOString(), retries: 0 } }
    get_task(taskId: string) { return this.taskRunner.get(taskId) }
    async stop(taskId?: string) { await this.taskRunner.stop(taskId) }
    reset() { this.bot.quit(); return new BotService(this.port, this.host, this.name) }
}
