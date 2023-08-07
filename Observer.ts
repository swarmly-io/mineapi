import { IndexedData } from "minecraft-data"
import { Bot } from "mineflayer"
import { Vec3 } from 'vec3';
import { groupBy } from "underscore"
import { Consequences, InventoryObservation, Observation } from "./types"

const EntityMaxDistanceSquared = Math.pow(32, 2) 

// https://wiki.vg/Protocol#Position
export const vec2key = function(vec: Vec3): number {
    return ((vec.x & 0x3FFFFFF) << 38) | ((vec.z & 0x3FFFFFF) << 12) | (vec.y & 0xFFF)
}

export const key2vec = function(key: number): Vec3 {
    let x = Math.floor(key / Math.pow(2, 38));
    let y = key & 0xFFF
    let z = Math.floor((key / Math.pow(2, 12)) & 0x3FFFFFF);
    if (x >= 1 << 25) { x -= Math.pow(2, 26) }
    if (y >= 1 << 11) { y -= Math.pow(2, 12) }
    if (z >= 1 << 25) { z -= Math.pow(2, 26) }
    return new Vec3(x, y, z)
}

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
        position: bot.entity?.position?.clone(),
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
        closeEntities:  Object.values(bot.entities)
                              .filter(x => x.position.distanceSquared(bot.entity.position) <= EntityMaxDistanceSquared),
        inventory: observeInventory(bot),
        world: {}
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

    if (consequences.world !== undefined) {
        merged.world = Object.entries(consequences.world).reduce((p, [k, v]) => (p[k] = v, p), observation.world)
    }

    return merged
}

export const prettyObservation = function(observation: Observation, mcData: IndexedData): Observation {
    let pretty = { ...observation }
    pretty.inventory = { ...observation.inventory }
    //pretty.inventory.items = { ...observation.inventory.items }
    pretty.closeEntities = [] // TODO: entities pollute the console, find a better way than to remove them
    pretty.inventory.items = Object.fromEntries(Object.entries(pretty.inventory.items).map(([key, value]) => [mcData.items[key].name, value]))
    //@ts-ignore
    pretty.world = Object.fromEntries(Object.entries(pretty.world).map(([key, value]) => [key2vec(key), mcData.blocks[value].name]))

    return pretty
}

export const prettyConsequences = function(consequences: Consequences, mcData: IndexedData): Consequences {

    let pretty = { ...consequences }
    if (pretty.success === false) return pretty

    if (pretty.inventory) {
        pretty.inventory = Object.fromEntries(Object.entries(pretty.inventory!).map(([key, value]) => [mcData.items[key].name, value]))
    }
    if (pretty.world) {
        //@ts-ignore
        pretty.world = Object.fromEntries(Object.entries(pretty.world).map(([key, value]) => [key2vec(key), mcData.blocks[value].name]))
    }

    return pretty
}