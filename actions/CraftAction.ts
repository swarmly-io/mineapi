import { RecipeNotFoundError } from "../errors/RecipeNotFoundError"
import { findBlock } from "../helpers/EnvironmentHelper"
import { craftableAmount, findRecipes } from "../helpers/RecipeHelper"
import { observeInventory } from "../Observer"
import { Observation, Consequences, SuccessfulConsequences } from "../types"
import { Action, ActionParams } from "./Action"
import { ActionDoResult } from "./types"
import { Block } from 'prismarine-block'

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

    async do(): Promise<ActionDoResult> {
        let craftingTablePos = findBlock(this.bot, 
            this.mcData.blocksByName.crafting_table.id, 
            this.options.allowedMaxDistance !== undefined ? this.options.allowedMaxDistance : 6.0)

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
            if (this.isCanceled) {
                return {
                    reason: "Action has been cancelled."
                }
            }
            let recipe = availableRecipes[i]
            let maxCount = Math.ceil((this.options.count! - crafted) / recipe.resultCount)
            let count = Math.min(maxCount, craftableAmount(recipe, inventory))
            await this.bot.craft(recipe.mineflayerRecipe, count, craftingTable ?? undefined)
            
            crafted += count * recipe.resultCount
            if (crafted >= this.options.count!) {
                break
            }
            inventory = observeInventory(this.bot)
        }

        
        if (crafted < this.options.count!) {
            return { reason: "Craft: Could not craft enough items" }
        }

        return true
    }

    async possible(observation: Observation): Promise<Consequences> {
        let craftingTable = findBlock(this.bot, 
            this.mcData.blocksByName.crafting_table.id, 
            this.options.allowedMaxDistance !== undefined ? this.options.allowedMaxDistance : 6.0, 
            observation)

        let itemIds = typeof this.options.itemIds === 'number' ? [this.options.itemIds] : this.options.itemIds

        let consequences: SuccessfulConsequences = { success: true, inventory: {}}
        let inventory = { items: {...observation.inventory.items}, emptySlots: observation.inventory.emptySlots} 
        let availableRecipes = itemIds.map(id => findRecipes(this.mcData, id, craftingTable !== null, inventory)).flat()

        if (availableRecipes.length === 0) {
            return { success: false, reason: `Craft: Could not find a recipe. Crafting table available: ${craftingTable !== null}`}
        }

        let crafted = 0
        for (let i = 0; i < availableRecipes.length; i++) {
            let recipe = availableRecipes[i]
            let maxCount = Math.ceil((this.options.count! - crafted) / recipe.resultCount)
            let craftCount = Math.min(maxCount, craftableAmount(recipe, inventory))
            
            Object.entries(recipe.ingredients)
                .forEach(([itemId, itemCount]) => {
                    inventory.items[itemId] -= itemCount * craftCount //
                    consequences.inventory![itemId] = (consequences.inventory![itemId] ?? 0) - (itemCount * craftCount)
                })
            consequences.inventory![recipe.mineflayerRecipe.result.id] = (inventory![recipe.mineflayerRecipe.result.id] ?? 0) + (recipe.mineflayerRecipe.result.count * craftCount)

            crafted += craftCount * recipe.resultCount
            if (crafted >= this.options.count!)
                break
        }

        if (crafted < this.options.count!) {
            return {
                success: false,
                reason: 'Craft: Cannot craft enough items'
            }
        }
        return consequences
    }
}