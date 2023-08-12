import { IndexedData, Recipe, RecipeItem, ShapedRecipe, ShapelessRecipe} from 'minecraft-data'
import { InventoryObservation } from '../types'
import prl, { RecipeClasses, Recipe as PrismarineRecipe } from 'prismarine-recipe'
import { MinecraftVersion } from '../Config'

//@ts-ignore
const PRecipe: RecipeClasses = prl(MinecraftVersion)

export type IngredientRecipe = {
    requiresTable: boolean,
    ingredients: Record<number, number>,
    resultCount: number,
    mineflayerRecipe: PrismarineRecipe
    ingredientLookup?: { [id: number]: string}
}

export const recipeItemToId = (item: RecipeItem): number => {
    if (item instanceof Array) {
        return item[0]!
    } else if (item instanceof Object) {
        return item.id!
    } else {
        return item!
    }
}

export const parseRecipe = (recipe: Recipe): IngredientRecipe => {
    // Apparently mcData.Recipe has either inShape or ingredients set

    let requiresTable = true
    let ingredients: number[]
    // @ts-ignore
    if (!!recipe.inShape) {
        let shapedRecipe = recipe as ShapedRecipe

        if (shapedRecipe.inShape.length <= 2){
            if (shapedRecipe.inShape.every(row => row.length <= 2)){
                requiresTable = false
            }
        }

        ingredients = shapedRecipe.inShape.flat()
                                          .filter(x => x !== null)
                                          .map(x => recipeItemToId(x))
    } else {
        let shapelessRecipe = recipe as ShapelessRecipe

        requiresTable = shapelessRecipe.ingredients.length > 4
        ingredients = shapelessRecipe.ingredients.map(x => recipeItemToId(x))
    }
    
    let mineflayerRecipe = new PRecipe.Recipe(recipe)

    return {
        requiresTable: requiresTable,
        ingredients: ingredients.reduce((p, c) => (p[c!] = (p[c!] ?? 0) + 1, p), {}),
        //@ts-ignore
        resultCount: mineflayerRecipe.result.count,
        mineflayerRecipe: mineflayerRecipe
    }
}

export const craftableAmount = (recipe: IngredientRecipe, inventory: InventoryObservation): number => {
    const craftableAmounts: number[] = [];

    for (const [itemId, itemCount] of Object.entries(recipe.ingredients)) {
        const availableItemCount = inventory.items[itemId] || 0;
        const craftableCount = Math.floor(availableItemCount / itemCount);
        if (craftableCount == 0) {
            console.log(recipe.ingredients)
            console.log(`Missing ${itemId} needs: ${itemCount} have: ${availableItemCount}`)
        } else {
            console.log(`Able to craft with ${itemId}`)
        }
        craftableAmounts.push(craftableCount);
    }

    // Find the minimum value from the craftable amounts, as it represents the limiting factor.
    const maxCraftableAmount = Math.min(...craftableAmounts);

    return maxCraftableAmount;
}

export const findRecipes = (mcData: IndexedData, itemId: number, hasCraftingTable: boolean, inventory: InventoryObservation) => {
    const recipe = mcData.recipes[itemId]
        .map(x => parseRecipe(x))
    
    const haveRequiredTable = recipe.filter(x => (!hasCraftingTable ? !x.requiresTable : true))
    if (haveRequiredTable.length == 0) {
        throw new Error("Needed crafting table but didn't have one")
    }
    const ableToCraftAmount = haveRequiredTable.filter(x=> craftableAmount(x, inventory) > 0)
    if (haveRequiredTable.length == 0) {
        throw new Error("Didn't have enough materials")
    }
    console.log("Craftable", ableToCraftAmount)
    return ableToCraftAmount
}