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
        closeEntities: Object.values(bot.entities).filter(x => x.position.distanceSquared(bot.entity.position) <= EntityMaxDistanceSquared),
        inventory: observeInventory(bot)
    }
}

export const mergeWithConsequences = (observation: Observation, consequences: Consequences): Observation => {
    let merged = { ...observation }
    
    if (consequences.inventory !== undefined) {
        merged.inventory.items = Object.entries(consequences.inventory!)
                                 .reduce((p, [k, v]) => (p[k] !== undefined ? p[k] += v : p[k] = v, p), observation.inventory.items)
    }

    return merged
}