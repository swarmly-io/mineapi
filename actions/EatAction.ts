import { Observation, Consequences } from "../types"
import { Action, ActionAnalysisPredicate, ActionParams } from "./Action"
import { ActionState } from "./BotActionState"
import { ActionDoResult } from "./types"

export type EatActionParams = {
    name?: string
}

export class EatAction extends Action<EatActionParams> {

    constructor(params: ActionParams<EatActionParams>) {
        super(params)
    }

    async do(): Promise<ActionDoResult> {
        // should food item be cooked
        // is fernace and coal available -> cook food
        // eat food raw
        return true
    }

    async possible(_: Observation): Promise<Consequences> {
         
        const success = false
        return success ? { success } : {
            success: success,
            reason: "Didn't meet criteria to fight"
        }
    }

    analyseFn(): ActionAnalysisPredicate {
        return (state: ActionState) => ({
          is_progressing: state.isEating,
          is_stuck: !state.isEating
        });
    }
}
