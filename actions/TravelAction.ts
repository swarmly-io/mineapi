import { Action, ActionParams } from "./Action";
import { goals } from 'mineflayer-pathfinder'
import { Observation, Consequences } from "../types";

export type TravelActionParams = {
    goal: goals.Goal,
}

export class TravelAction extends Action<TravelActionParams> {

    constructor(params: ActionParams<TravelActionParams>) {
        super(params)
    }

    async do(): Promise<any> {
        await this.bot.pathfinder.goto(this.options.goal)
    }

    async possible(observation: Observation): Promise<Consequences> {
        // TODO: Should there be restrictions (like checking for enough food if the goal is far away)
        // TODO: Find a good way to get position of a goal
        return {
            success: true,
        }
    }
}