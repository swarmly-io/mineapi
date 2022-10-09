import {Action, ActionParams} from "./Action";
import {Consequences, Observation, SuccessfulConsequences} from "../types";
import {mergeWithConsequences, observe, prettyConsequences, prettyObservation} from "../Observer";
import {ActionDoResult} from "./types";


export type ChainActionParams = {
    actions: Action<any>[]
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class ChainAction extends Action<ChainActionParams> {

    constructor(params: ActionParams<ChainActionParams>) {
        super(params);
    }

    private combineConsequences(base: SuccessfulConsequences, other: SuccessfulConsequences) {
        let combined = { ...base }

        if (other.position)
            combined.position = other.position

        if (other.time)
            combined.time = other.time

        if (other.inventory)  {
            combined.inventory = Object.entries(other.inventory)
                .reduce((p, [key, value]) => (p[key] = (p[key] ?? 0) + value, p), { ...base.inventory })
        }

        if (other.world) {
            combined.world = Object.entries(other.world)
                .reduce((p, [key, value]) => (p[key] = (p[key] ?? 0) + value, p), { ...base.world })
        }

        return combined;
    }

    async possible(observation: Observation): Promise<Consequences> {
        this.logger.debug(`Testing chain: [${this.options.actions.map(x => x.constructor.name)}]`)
        let consequences: SuccessfulConsequences | undefined = undefined

        for (let i = 0; i < this.options.actions.length; i++) {
            let action = this.options.actions[i]
            this.logger.debug(`Testing action ${i} (${action.constructor.name})`, { params: action.options, observation: prettyObservation(observation, this.mcData) })

            let result = await action.possible(observation)
            if (!result.success) {
                this.logger.warn(`Chain not possible. Action ${i} (${action.constructor.name}) failed: '${result.reason}'`)
                return {
                    success: false,
                    reason: `Action ${i} failed: ${result.reason}`
                }
            }
            this.logger.debug(`Action ${i} (${action.constructor.name}) possible`, { result: prettyConsequences(result, this.mcData), observation: observation })
            //merge the consequences of previous action with the consequences
            observation = mergeWithConsequences(observation, result)
            if (consequences === undefined)
                consequences = result
            else
                consequences = this.combineConsequences(consequences!, result)
        }

        this.logger.debug(`Chain is possible.`, { endState: prettyObservation(observation, this.mcData) })

        return consequences ?? { success: false, reason: "" }
    }

    async do(): Promise<ActionDoResult> {
        this.logger.debug(`Trying to do chain: [${this.options.actions.map(x => x.constructor.name)}]`)

        for (let i = 0; i < this.options.actions.length; i++) {

            if (this.isCanceled) {
                return {
                    reason: "Action has been cancelled."
                }
            }

            let action = this.options.actions[i]
            this.logger.debug(`Executing action ${i} (${action.constructor.name})`, {params: action.options})
            let actionResult = await action.do()
            if (true !== actionResult) {
                this.logger.error(`Action ${i} (${action.constructor.name}) failed`, {result: actionResult}, { currentEnv: prettyObservation(await observe(this.bot), this.mcData) })
                return {
                    reason: `Action ${i} failed. Reason: ${actionResult.reason}`
                }
            }
            await sleep(500) // TODO: Maybe don't pause after every action, but only when needed (f.e. collected items from findAndCollect action may not be in the inventory yet.)
        }

        return true
    }
}