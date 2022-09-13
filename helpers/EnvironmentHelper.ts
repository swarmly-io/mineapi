import { Bot } from "mineflayer"
import { Vec3 } from 'vec3'

export const findBlock = function(bot: Bot, blockId: number, maxDistance: number, center?: Vec3) {
    return bot.findBlock({
        matching: blockId,
        maxDistance: maxDistance,
        point: center ?? bot.entity.position
    })
}

export const findBlocks = function(bot: Bot, blockId: number, maxDistance: number, count: number, center?: Vec3) {
    return bot.findBlocks({
        matching: blockId,
        maxDistance: maxDistance,
        point: center ?? bot.entity.position,
        count: count
    })
}