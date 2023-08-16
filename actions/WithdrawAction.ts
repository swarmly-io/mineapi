import { Action, ActionAnalysisPredicate, ActionParams } from "./Action";
import { ActionDoResult } from "./types";
import { ActionState } from "./BotActionState";
import { findBlock } from "../helpers/EnvironmentHelper";
import { lookAtBlock, moveToPositionWithRetry } from "../helpers/TravelHelper";
import { sleep } from "../Attributes";

export type WithdrawActionParams = {
    items: { [item: number]: number }
}

export class DepositAction extends Action<WithdrawActionParams> {

    constructor(params: ActionParams<WithdrawActionParams>) {
        super(params)
    }

    async do(possibleCheck: boolean = false): Promise<ActionDoResult> {
        const chestPos = findBlock(this.bot, this.mcData.blocksByName["chest"].id, 100)
        if (!chestPos) {
            return { reason: "Couldn't find chest" }
        }
        await moveToPositionWithRetry(this.bot, chestPos)
        const chestBlock = this.bot.blockAt(chestPos)
        if (!chestBlock) {
            return { reason: "Had trouble opening chest" }
        }
        lookAtBlock(this.bot, chestBlock)
        const chest = await this.bot.openChest(chestBlock)
        await sleep(50)

        const items = chest.items().filter(x=> (this.options.items[this.mcData.itemsByName[x.name].id + ""] || 0) <= x.count)
        if (items.length !== Object.keys(this.options.items).length) {
            return { reason: "Items not found" }
        }
        if (possibleCheck) {
            chest.close()
            return true
        }

        // todo verify got items from chest
        try {
            for (let [item, quantity] of Object.entries(this.options.items)) {
                // @ts-ignore
                await chest.withdraw(item * 1, null, quantity)
                await sleep(10)
            }
            chest.close()
            this.bot.chat("Finished getting items from chest")
        } catch(e) {
            console.log("Error in getting items from chest", e)
            return { reason: "Couldn't withdraw from chest" }
        }

        return true
    }

    analyseFn(): ActionAnalysisPredicate {
        return (state: ActionState) => ({
          is_progressing: state.isMoving,
          is_stuck: !state.isMoving
        });
    }
}