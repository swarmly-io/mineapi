import { RecipeNotFoundError } from "../errors/RecipeNotFoundError.js"
import { findBlock } from "../helpers/EnvironmentHelper.js"
import { craftableAmount, findRecipes } from "../helpers/RecipeHelper.js"
import { observeInventory } from "../Observer.js"
import { Observation, Consequences } from "../types.js"
import { Action, ActionParams } from "./Action.js"

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

    async do(): Promise<any> {
        let craftingTable = findBlock(this.bot, 
            this.mcData.blocksByName.crafting_table.id, 
            this.options.allowedMaxDistance !== undefined ? this.options.allowedMaxDistance : 6.0, 
            this.bot.entity.position)
        

        let itemIds = typeof this.options.itemIds === 'number' ? [this.options.itemIds] : this.options.itemIds

        let inventory = observeInventory(this.bot)
        let availableRecipes = itemIds.map(id => findRecipes(this.mcData, id, craftingTable !== null, inventory)).flat()

        if (availableRecipes.length === 0) 
            throw new RecipeNotFoundError(typeof this.options.itemIds === 'number' ? this.options.itemIds : -1)

        let crafted = 0
        for (let i = 0; i < availableRecipes.length; i++) {
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
    }

    async possible(observation: Observation): Promise<Consequences> {
        let craftingTable = findBlock(this.bot, 
            this.mcData.blocksByName.crafting_table.id, 
            this.options.allowedMaxDistance !== undefined ? this.options.allowedMaxDistance : 6.0, 
            observation.position)
        

        let itemIds = typeof this.options.itemIds === 'number' ? [this.options.itemIds] : this.options.itemIds

        let consequences: Consequences = { success: true, inventory: {}}
        let inventory = observation.inventory
        let availableRecipes = itemIds.map(id => findRecipes(this.mcData, id, craftingTable !== null, inventory)).flat()
        for (let i = 0; i < availableRecipes.length; i++) {
            let recipe = availableRecipes[i]
            let craftCount = craftableAmount(recipe, inventory)
            
            Object.entries(recipe.ingredients)
                .forEach(([itemId, itemCount]) => {
                    inventory[itemId] -= itemCount * craftCount
                    consequences[itemId] = (consequences[itemId] ?? 0) - (itemCount * craftCount)
                })
        }

        return consequences
    }
}