import { Bot } from "mineflayer"
import { Vec3 } from 'vec3'
import { key2vec, vec2key } from "../Observer"
import { Observation } from "../types"

export const getBlockAt = function(pos: Vec3, bot: Bot, observation?: Observation): number | undefined {
    if (observation) {
        let key = vec2key(pos)
        if (observation.world[key]) 
            return observation.world[key]
    }
    return bot.blockAt(pos)?.type
}

export const findBlock = function(bot: Bot, blockId: number | number[], maxDistance: number, observation?: Observation): Vec3 | undefined {
    return findBlocks(bot, blockId, maxDistance, 1, observation)[0]
}

export const findBlocks = function(bot: Bot, blockId: number | number[], maxDistance: number, count: number, observation?: Observation) {
    
    let blockIds = typeof blockId == 'number' ? [blockId] : blockId

    let blocks: Vec3[] = []
    const simulatedWorld = observation && observation.world && Object.keys(observation.world).length > 0

    if (simulatedWorld) {
        //@ts-ignore
        blocks = Object.entries(observation.world).filter(([_, blockId]) => blockIds.includes(blockId)).map(([pos, _]) => key2vec(pos))
    }

    if (simulatedWorld && !observation.position) {
        return []
    }
    
    if (!bot.entity || !bot.entity.position) {
        return []
    }

    blocks.push(...bot.findBlocks({
        matching: blockId,
        maxDistance: maxDistance,
        point: observation?.position ?? bot.entity?.position,
        count: count
    }).filter(x => !blocks.includes(x)))

    return blocks
}