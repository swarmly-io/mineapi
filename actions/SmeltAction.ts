import { findBlock } from "../helpers/EnvironmentHelper"
import { observeInventory } from "../Observer"
import { Observation, Consequences } from "../types"
import { Action, ActionAnalysisPredicate, ActionParams } from "./Action"
import { ActionState } from "./BotActionState"
import { ActionDoResult } from "./types"
import { Block } from 'prismarine-block'
import pathfinder from 'mineflayer-pathfinder'
const { GoalNear } = pathfinder.goals
import smelting from '../helpers/smelting.json'
import { sleep } from "../Attributes"

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
            this.options.allowedMaxDistance !== undefined ? this.options.allowedMaxDistance : 6.0, observation)

        let furnace: Block | null = null
        if (furnacePos)
            furnace = this.bot.blockAt(furnacePos)

        if (furnace && furnacePos) {
            if (this.bot.entity.position.distanceTo(furnacePos) > 1) {
                this.bot.pathfinder.setGoal(new GoalNear(furnacePos?.x, furnacePos?.y, furnacePos?.z, 1))
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
            const inputItem = smelting.filter(x=> x.result.includes(outputItem.name) && haveItem(x))
                                      .map(x=> {
                                          const item = x.ingredient.item.replace("minecraft:", "")
                                          
                                          return { "item": this.mcData.itemsByName[item], "cookingTime": x.cookingtime }
                                      })
            if (inputItem.length == 0) {
                throw new Error("Not enough items to smelt")
            }
            
            if (possibleCheck) {
                continue
            }
            const openFurnace = await this.bot.openFurnace(furnace);
            if (openFurnace.inputItem()) {
                openFurnace.takeInput()
            }
            await sleep(50);
            await openFurnace.putInput(inputItem[0]["item"].id, null, (this.options?.count ?? 1))
            const fuel = this.mcData.itemsByName["coal"]
            await sleep(50);
            await openFurnace.putFuel(fuel.id, null, this.options.count ?? 1)

            let count = 0;
            while (!completed && count < 60) {
                await sleep(1000)
                count+=1;
                try {
                    const item = await openFurnace.takeOutput()
                    if (item) {
                        completed = true;
                        this.bot.chat(`Completed smelting ${item.displayName}`)
                        break;
                    }
                } catch (e) {
                    console.log("Not ready yet")
                }
            }
        }
        if (possibleCheck) {
            return true
        }
        
        // @ts-ignore mutated in listener
        return completed
    }

    analyseFn(): ActionAnalysisPredicate {
        return (state: ActionState) => ({
          is_progressing: state.isMoving,
          is_stuck: !state.isMoving,
        });
    }
}