import { Bot } from "mineflayer"
import { IndexedData } from "minecraft-data"
import { Consequences, Observation } from "../types"
import { ActionDoResult } from "./types";
import { ActionState } from "./BotActionState";

export const DEFAULT_ALLOWED_DISTANCE = 16

export type ActionParams<T> = {
    bot: Bot,
    mcData: IndexedData
} & T;

export type ActionAnalysis = {
    is_stuck: boolean,
    is_progressing: boolean
}

export type ActionAnalysisPredicate = (state: ActionState) => ActionAnalysis;

export class Action<T> {
    bot: Bot
    mcData: IndexedData
    options: T

    constructor(params: ActionParams<T>) {
        let { bot, mcData, ...options} = params;
        this.bot = bot
        this.mcData = mcData
        this.options = options as T
    }

    async do(): Promise<ActionDoResult> {    
        throw new Error('Cannot call do() on empty action')
    }

    async possible (observation: Observation) : Promise<Consequences> {
        throw new Error('Cannot call possible() on empty action')
    }

    analyseFn(): ActionAnalysisPredicate {
        return (s) => ({ is_stuck: true, is_progressing: false } as ActionAnalysis)
    }
}

