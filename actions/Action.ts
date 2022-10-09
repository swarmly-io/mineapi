import { Bot } from "mineflayer"
import { IndexedData } from "minecraft-data"
import { Consequences, Observation } from "../types"
import { ActionDoResult } from "./types";
import {Logger} from "tslog";

export const DEFAULT_ALLOWED_DISTANCE = 16

export type ActionParams<T> = {
    bot: Bot,
    mcData: IndexedData
    logger: Logger
} & T;

export class Action<T> {
    bot: Bot
    mcData: IndexedData
    logger: Logger
    options: T

    isCanceled: boolean

    constructor(params: ActionParams<T>) {
        let { bot, mcData, logger, ...options} = params;
        this.bot = bot
        this.mcData = mcData
        this.logger = logger
        this.options = options as T
        this.isCanceled = false
    }

    setCancelled() {
        this.isCanceled = true;
    }

    async do(): Promise<ActionDoResult> {    
        throw new Error('Cannot call do() on empty action')
    }

    async possible (observation: Observation) : Promise<Consequences> {
        throw new Error('Cannot call possible() on empty action')
    }
}

