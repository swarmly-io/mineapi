import { IndexedData, Recipe, RecipeItem, ShapedRecipe, ShapelessRecipe} from 'minecraft-data'
import { InventoryObservation } from '../types.js'
import prl, { RecipeClasses, Recipe as PrismarineRecipe } from 'prismarine-recipe'
import { MinecraftVersion } from '../Config.js'

//@ts-ignore
const PRecipe: RecipeClasses = prl(MinecraftVersion)

export type IngredientRecipe = {
    requiresTable: boolean,
    ingredients: Record<number, number>,
    resultCount: number,
    mineflayerRecipe: PrismarineRecipe
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
    if (recipe.inShape !== undefined) {
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
    
    return {
        requiresTable: requiresTable,
        ingredients: ingredients.reduce((p, c) => (p[c!] = (p[c!] ?? 0) + 1, p), {}),
        //@ts-ignore
        resultCount: recipe.result!.count as number,
        mineflayerRecipe: new PRecipe.Recipe(recipe)
    }
}

export const craftableAmount = (recipe: IngredientRecipe, inventory: InventoryObservation): number => {
    return Math.min(
        ...Object.entries(recipe.ingredients)
                 .map(([itemId, itemCount]) => Math.floor((inventory.items[itemId] ?? 0) / itemCount)))
}

export const findRecipes = (mcData: IndexedData, itemId: number, hasCraftingTable: boolean, inventory: InventoryObservation) => {
    return mcData.recipes[itemId]
        .map(x => parseRecipe(x))
        .filter(x => (!hasCraftingTable ? !x.requiresTable : true) && craftableAmount(x, inventory) > 0)
}