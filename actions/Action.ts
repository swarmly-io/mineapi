import { Bot } from "mineflayer"
import { IndexedData } from "minecraft-data"
import { Consequences, Observation } from "../types.js"

export const DEFAULT_ALLOWED_DISTANCE = 16

export type ActionParams<T> = {
    bot: Bot,
    mcData: IndexedData
} & T;

export class Action<T> {
    bot: Bot
    mcData: IndexedData
    options: T

    constructor(params: ActionParams<T>) {
        this.bot = params.bot
        this.mcData = params.mcData
        this.options = params
    }

    async do(): Promise<any> {    
        throw new Error('Cannot call do() on empty action')
    }

    async possible (observation: Observation) : Promise<Consequences> {
        throw new Error('Cannot call possible() on empty action')
    }
}

