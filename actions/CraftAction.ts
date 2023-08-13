import { findBlock } from "../helpers/EnvironmentHelper"
import { craftableAmount, findRecipes } from "../helpers/RecipeHelper"
import { observeInventory } from "../Observer"
import { Action, ActionAnalysisPredicate, ActionParams } from "./Action"
import { ActionState } from "./BotActionState"
import { ActionDoResult } from "./types"
import { Block } from 'prismarine-block'
import { Observation } from "../types"
import { moveToPositionWithRetry, timeoutPromise } from "../helpers/TravelHelper"

export type CraftActionParams = {
    itemIds: number | number[],
    count?: number,
    allowWalking?: boolean,
    allowedMaxDistance?: number
} 

export class CraftAction extends Action<CraftActionParams> {

    constructor(params: ActionParams<CraftActionParams>) {
        super(params)
        params.count = params.count ?? 1
    }

    async do(possibleCheck: boolean = false, observation: Observation | undefined): Promise<ActionDoResult> {
        let craftingTablePos = findBlock(this.bot, 
            this.mcData.blocksByName.crafting_table.id, 
            this.options.allowedMaxDistance !== undefined ? this.options.allowedMaxDistance : 6.0, observation)

        let craftingTable: Block | null = null
        if (craftingTablePos)
            craftingTable = this.bot.blockAt(craftingTablePos)

        let itemIds = typeof this.options.itemIds === 'number' ? [this.options.itemIds] : this.options.itemIds

        let inventory = observeInventory(this.bot)
        let availableRecipes = itemIds.map(id => findRecipes(this.mcData, id, craftingTable !== null, inventory)).flat()
        if (availableRecipes.length === 0) 
            return { reason: `Craft: Could not find recipe for item. Crafting table available: ${craftingTable !== null}`}

        let crafted = 0
        for (let i = 0; i < availableRecipes.length; i++) {
            let recipe = availableRecipes[i]
            let maxCount = Math.ceil((this.options.count! - crafted) / recipe.resultCount)
            let count = Math.min(maxCount, craftableAmount(recipe, inventory))
            console.log(`Going to craft ${count}`)
            if (!possibleCheck) {
                if (craftingTable && craftingTablePos && !possibleCheck) {
                    await moveToPositionWithRetry(this.bot, craftingTablePos)
                }
                try {
                    await Promise.race([timeoutPromise(10000), this.bot.craft(recipe.mineflayerRecipe, Math.max(count, recipe.resultCount), craftingTable ?? undefined)])
                    crafted += count * recipe.resultCount
                    this.bot.chat(`Crafted: ${this.mcData.items[recipe.mineflayerRecipe.result.id].displayName}`)
                    if (crafted >= this.options.count!) {
                        break
                    }
                } catch(e) {
                    console.log("error in crafting",e)
                    return { reason: 'Failed to craft recipe' }
                }
                inventory = observeInventory(this.bot)
                if (crafted < this.options.count!) {
                    return { reason: "Craft: Could not craft enough items" }
                }
            }
        }

        return true
    }

    analyseFn(): ActionAnalysisPredicate {
        return (state: ActionState) => ({
          is_progressing: state.isMoving,
          is_stuck: !state.isMoving,
        });
    }
}