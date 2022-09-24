import { BlockNotFoundError } from "../errors/BlockNotFoundError";
import { findBlock } from "../helpers/EnvironmentHelper";
import { Observation, Consequences } from "../types";
import { Action, ActionParams, DEFAULT_ALLOWED_DISTANCE } from "./Action";
import { ActionDoResult } from "./types";

export type SleepActionParams = {
    allowedMaxDistance?: number
}

export class SleepAction extends Action<SleepActionParams> {

    constructor(params: ActionParams<SleepActionParams>) {
        params.allowedMaxDistance = params.allowedMaxDistance ?? DEFAULT_ALLOWED_DISTANCE
        super(params)
    }

    async possible(observation: Observation): Promise<Consequences> {
        let canSleep = false
        
        if (observation.weather.thunderLevel > 0) canSleep = true
        else {
            let min = observation.weather.isRaining ? 12010 : 12542
            let max = observation.weather.isRaining ? 23991 : 23459
            if (observation.time >= min && observation.time < max) {
                canSleep = true
            }
        }

        if (!canSleep) 
            return { success: false, reason: 'Sleep: Can only sleep during night or thunderstorm ' }

        let block = findBlock(
            this.bot,
            this.mcData.blocksArray.filter(x => x.name.endsWith('_bed')).map(x => x.id),
            this.options.allowedMaxDistance!,
            observation
        )
        if (block === null) 
            return { success: false, reason: 'Sleep: No bed found' }

        return { success: true, time: 0, position: block }
    }
    
    async do(): Promise<ActionDoResult> {
        // TODO: Code doesn't check whether the bed is occupied
        let block = findBlock(
            this.bot,
            this.mcData.blocksArray.filter(x => x.name.endsWith('_bed')).map(x => x.id),
            this.options.allowedMaxDistance!)
        if (block === undefined) {
            return { reason: "Sleep: Could not find bed." }
        }
        await this.bot.sleep(this.bot.blockAt(block)!)
        
        return true
    }
}