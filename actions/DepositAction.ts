import { Action, ActionAnalysisPredicate, ActionParams } from "./Action";
import { ActionDoResult } from "./types";
import { ActionState } from "./BotActionState";
import { findBlock } from "../helpers/EnvironmentHelper";
import { observeInventory } from "../Observer";
import { lookAtBlock, moveToPositionWithRetry } from "../helpers/TravelHelper";
import { sleep } from "../Attributes";

export type DepositActionParams = {
    items: { [item: number]: number }
}

export class DepositAction extends Action<DepositActionParams> {

    constructor(params: ActionParams<DepositActionParams>) {
        super(params)
    }

    async do(possibleCheck: boolean = false): Promise<ActionDoResult> {
        const chestPos = findBlock(this.bot, this.mcData.blocksByName["chest"].id, 100)
        if (!chestPos) {
            return { reason: "Couldn't find chest" }
        }
        const inventory = observeInventory(this.bot)
        const items = Object.entries(this.options.items).filter(x=> {
            const itemCount = (inventory.items[x[0]] || 0);
            return itemCount > 0;
        })
        if (items.length == 0) {
            return { reason: "No items to deposit" }
        }
        if (possibleCheck) {
            return true
        }

        try {
            await moveToPositionWithRetry(this.bot, chestPos)
            const chestBlock = this.bot.blockAt(chestPos)
            if (!chestBlock) {
                return { reason: "Had trouble opening chest" }
            }
            lookAtBlock(this.bot, chestBlock)
            const chest = await this.bot.openChest(chestBlock)
            await sleep(50)
            for (let [item, quantity] of items) {
                // @ts-ignore
                await chest.deposit(item * 1, null, quantity)
            }
            await sleep(50)
            chest.close()
            this.bot.chat("Finished adding items in chest")
        } catch(e) {
            console.log("Error in adding items to chest", e)
            return { reason: "Couldn't deposit to chest" }
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