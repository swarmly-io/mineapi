import { BlockNotFoundError } from "../errors/BlockNotFoundError";
import { findBlock } from "../helpers/EnvironmentHelper";
import { Observation, Consequences } from "../types";
import { Action, ActionParams, DEFAULT_ALLOWED_DISTANCE } from "./Action";

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
            return { success: false }

        let block = findBlock(
            this.bot,
            this.mcData.blocksArray.filter(x => x.name.endsWith('_bed')).map(x => x.id),
            this.options.allowedMaxDistance!,
            observation.position
        )
        if (block === null) 
            return { success: false }

        return { success: true, time: 0, position: block.position }
    }
    
    async do(): Promise<any> {
        let block = findBlock(
            this.bot,
            this.mcData.blocksArray.filter(x => x.name.endsWith('_bed')).map(x => x.id),
            this.options.allowedMaxDistance!)
        if (block === null) {
            throw new BlockNotFoundError(this.mcData.blocksByName.white_bed.id)
        }
        await this.bot.sleep(block)
    }
}