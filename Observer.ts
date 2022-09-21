import { IndexedData } from "minecraft-data"
import { Bot } from "mineflayer"
import { groupBy } from "underscore"
import { Consequences, InventoryObservation, Observation } from "./types"

const EntityMaxDistanceSquared = Math.pow(32, 2) 

export const observeInventory = function(bot: Bot): InventoryObservation {
    // returns a dictionary with item id's as keys and the number of items as the value
    let items = Object.entries(groupBy(bot.inventory.items(), (item) => item.type)).reduce((prev: any, [key, val]: any) => 
        (prev[key] = val.map(x => x.count).reduce((p, c) => p + c, 0), prev)
    , {})

    return {
        items: items,
        emptySlots: bot.inventory.emptySlotCount()
    }
}

export const observe = async function(bot: Bot): Promise<Observation> {
    return {
        position: bot.entity.position.clone(),
        status: {
            health: bot.health,
            food: bot.food,
            saturation: bot.foodSaturation,
            oxygen: bot.oxygenLevel
        },
        xp: bot.experience.level,
        time: bot.time.timeOfDay,
        weather: {
            isRaining: bot.isRaining,
            thunderLevel: bot.thunderState
        },
        closeEntities: Object.values(bot.entities)
                            .filter(x => x.position.distanceSquared(bot.entity.position) <= EntityMaxDistanceSquared),
        inventory: observeInventory(bot)
    }
}

export const mergeWithConsequences = (observation: Observation, consequences: Consequences): Observation => {
    let merged = { ...observation }
    
    if (consequences.success === false) return observation

    if (consequences.inventory !== undefined) {
        merged.inventory.items = Object.entries(consequences.inventory!)
                                 .reduce((p, [k, v]) => (p[k] !== undefined ? p[k] += v : p[k] = v, p), merged.inventory.items)
    }

    if (consequences.time !== undefined) {
        merged.time = consequences.time!
    }

    if (consequences.position !== undefined) {
        merged.position = consequences.position!
    }

    return merged
}

export const prettyObservation = function(observation: Observation, mcData: IndexedData): Observation {
    let pretty = { ...observation }
    pretty.inventory = { ...observation.inventory }
    //pretty.inventory.items = { ...observation.inventory.items }
    pretty.closeEntities = [] // TODO: entities pollute the console, find a better way than to remove them
    pretty.inventory.items = Object.fromEntries(Object.entries(pretty.inventory.items).map(([key, value]) => [mcData.items[key].name, value]))

    return pretty
}

export const prettyConsequences = function(consequences: Consequences, mcData: IndexedData): Consequences {

    let pretty = { ...consequences }
    if (pretty.success === false) return pretty

    if (pretty.inventory) {
        pretty.inventory = Object.fromEntries(Object.entries(pretty.inventory!).map(([key, value]) => [mcData.items[key].name, value]))
    }

    return pretty
}