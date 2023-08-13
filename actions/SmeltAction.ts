import { findBlock } from "../helpers/EnvironmentHelper"
import { observeInventory } from "../Observer"
import { Observation } from "../types"
import { Action, ActionAnalysisPredicate, ActionParams } from "./Action"
import { ActionState } from "./BotActionState"
import { ActionDoResult } from "./types"
import { Block } from 'prismarine-block'
import smelting from '../helpers/smelting.json'
import { sleep } from "../Attributes"
import { lookAtBlock, moveToPosition } from "../helpers/TravelHelper"
import { Furnace } from "mineflayer"

export type SmeltActionParams = {
    itemIds: number | number[],
    count?: number,
    allowWalking?: boolean,
    allowedMaxDistance?: number
}

export class SmeltAction extends Action<SmeltActionParams> {

    constructor(params: ActionParams<SmeltActionParams>) {
        super(params)
        params.count = params.count ?? 1
    }

    async do(possibleCheck: boolean = false, observation: Observation | undefined = undefined): Promise<ActionDoResult> {
        let furnacePos = findBlock(this.bot,
            this.mcData.blocksByName.furnace.id,
            this.options.allowedMaxDistance !== undefined ? this.options.allowedMaxDistance : 6.0)

        let furnace: Block | null = null
        if (furnacePos)
            furnace = this.bot.blockAt(furnacePos)

        if (furnace && furnacePos) {
            if (this.bot.entity.position.distanceTo(furnacePos) > 1 && !possibleCheck) {
                const positionInFront = furnacePos.offset(0, 0, 0);
                await moveToPosition(this.bot, positionInFront)
                this.bot.chat("Moved to furnace")
            }
        } else {
            return { reason: "No furnace found" } as ActionDoResult
        }

        let inventory = await observeInventory(this.bot)

        const haveFuel = inventory.items[this.mcData.itemsByName["coal"].id] >= (this.options.count ?? 1)
        if (!haveFuel) {
            return { reason: "Not enough fuel" } as ActionDoResult
        }

        const haveItem = (x) => {
            const item = x.ingredient.item.replace("minecraft:", "");
            const itemId = this.mcData.itemsByName[item].id
            const inventoryItemCount = inventory.items[itemId]
            return inventoryItemCount > 0
        }

        let itemIds = typeof this.options.itemIds === 'number' ? [this.options.itemIds] : this.options.itemIds
        let completed = false
        for (const itemId of itemIds) {
            const outputItem = this.mcData.items[itemId];
            const inputItem = smelting.filter(x => x.result.includes(outputItem.name) && haveItem(x))
                .map(x => {
                    const item = x.ingredient.item.replace("minecraft:", "")

                    return { "item": this.mcData.itemsByName[item], "cookingTime": x.cookingtime }
                })
            if (inputItem.length == 0) {
                throw new Error("Not enough items to smelt")
            }

            if (possibleCheck) {
                continue
            }

            let openFurnace: Furnace | null = await this.getOpenFurnace(furnace, inputItem)
            if (!openFurnace) {
                return { reason: "Had difficulty opening furnace" }
            }

            let count = 0;
            while (!completed && count < 30) {
                await sleep(5000)
                count += 1;
                try {
                    const item = await openFurnace!.takeOutput()
                    if (item) {
                        completed = true;
                        this.bot.chat(`Completed smelting ${item.displayName}`)
                        openFurnace.close()
                        break;
                    }
                } catch (e) {
                    console.log("Not ready yet", e)
                }
            }
        }
        if (possibleCheck) {
            return true
        }

        // @ts-ignore mutated in listener
        return completed
    }

    private async getOpenFurnace(furnace: Block, inputItem) {
        lookAtBlock(this.bot, furnace)
        let positionsAround = [
            furnace.position.offset(1, 0, 0),
            furnace.position.offset(-1, 0, 0),
            furnace.position.offset(0, 0, 1),
            furnace.position.offset(0, 0, -1) // Z-1
        ]
        let openFurnace: Furnace | null = null
        const resolveAfterTimeout: (x: number) => Promise<null> = ms => new Promise(resolve => setTimeout(() => resolve(null), ms))
        while (positionsAround.length > 0 && !openFurnace) {
            openFurnace = await Promise.race([this.bot.openFurnace(furnace), resolveAfterTimeout(2000)])
            if (openFurnace == null) {
                await moveToPosition(this.bot, positionsAround.pop())
            } else {
                if (openFurnace.inputItem()) {
                    await openFurnace.takeInput()
                }
                if (openFurnace.outputItem()) {
                    await openFurnace.takeOutput()
                }
                try {
                    await sleep(50)
                    if (inputItem) await openFurnace.putInput(inputItem[0]["item"].id, null, (this.options?.count ?? 1))
                    const fuel = this.mcData.itemsByName["coal"]
                    await sleep(50)
                    await openFurnace.putFuel(fuel.id, null, this.options.count ?? 1)
                } catch (e) {
                    openFurnace.close()
                    openFurnace = null
                    console.log("Failed to open furnace", e)
                }
            }
        }
        return openFurnace
    }

    analyseFn(): ActionAnalysisPredicate {
        return (state: ActionState) => ({
            is_progressing: state.isMoving,
            is_stuck: !state.isMoving,
        });
    }
}