import { goals, Movements } from 'mineflayer-pathfinder';
import { Entity } from 'prismarine-entity';
import { Vec3 } from 'vec3';

// place | person | entity | point | block
// exact | nearest | furthest
export interface Point {
    x: number
    y: number
    z: number
}
export interface TravelGoal {
    type: "place" | "person" | "entity" | "point"
    moveType?: "exact" | "follow"
    value: Point | Entity
}

export function createGoal(goal: TravelGoal) {
    if (goal.type == 'point') {
        const point = goal.value as Point
        return new goals.GoalGetToBlock(point.x, point.y, point.z)
    }
    if (goal.type == "person") {
        // todo resolve person
        const entity = goal.value as Entity
        if (goal.moveType == 'follow') {
            return new goals.GoalFollow(entity, 5)
        }
        else {
            return new goals.GoalNear(entity.position.x, entity.position.y, entity.position.z, 1)
        }
    }
    if (goal.type == 'entity') {
        const entity = goal.value as Entity
        return new goals.GoalNear(entity.position.x, entity.position.y, entity.position.z, 1)
    }
}

export function goTo(bot, position) {
    const defaultMove = new Movements(bot);
    bot.pathfinder.setMovements(defaultMove);
    bot.pathfinder.setGoal(new goals.GoalNear(position.x, position.y, position.z, 1));
}

export const timeoutPromise = (timeMs) => new Promise((_, reject) => {
    setTimeout(() => {
        reject(new Error('Navigation timed out!'));
    }, timeMs);
});

export const nudge = async (bot, magnitude = 1) => {
    const toVec = (x) => new Vec3(x.x, x.y, x.z)
    const getRandomSurroundingCoord = () => (toVec({
        x: bot.entity.position.x - 1 * magnitude,
        y: bot.entity.position.y,
        z: bot.entity.position.z - 1 * magnitude
    }));
    const coord = getRandomSurroundingCoord();
    bot.chat("Nudging")
    bot.setControlState('back', true)

    await moveToPosition(bot, coord)
}

export async function moveToPositionWithRetry(bot, position: Vec3, retries = 0) {
    if (position.distanceTo(bot) < 1 || retries > 5) {
        return Promise.resolve()
    }
    const getTimeToTimeout = (bot, pos) => (pos.distanceTo(bot.entity.position)) /* blocks a second */ * 1000
    console.log("Timeout should be", getTimeToTimeout(bot, position))
    // limit a bot getting stuck to 30 seconds
    try {
        await Promise.race([moveToPosition(bot, position), timeoutPromise(getTimeToTimeout(bot, position) * 2)])
    } catch(e) {
        console.log("Retrying navigation")
        await nudge(bot, retries)
        return await moveToPositionWithRetry(bot, position, retries + 1)
    }
}

export async function moveToPosition(bot, position) {
    return new Promise((resolve, reject) => {
        bot.pathfinder.setGoal(new goals.GoalNear(position.x, position.y, position.z, 1));
        let previousPos = new Vec3(position.x, position.y, position.z);
        const getVelocity = (current, previous) => {
            if (!previous) return 0;
          
            const dx = current.x - previous.x;
            const dy = current.y - previous.y;
            const dz = current.z - previous.z;
          
            // Compute the difference between the two positions (Euclidean distance)
            return Math.sqrt(dx * dx + dy * dy + dz * dz);
        }
        
        const interval = setInterval(() => {
            const velocity = getVelocity(bot.entity.position, previousPos)
            if (velocity < 0.05 && position.distanceTo(bot.entity.position) > 5) { 
              clearInterval(interval)
              reject()
            }
            previousPos = bot.entity.position
          }, 1000);
        
        bot.once('goal_reached', (x) => {
            clearInterval(interval)
            resolve(x)
        });
        bot.once('goal_updated', (x) => {
            clearInterval(interval)
            reject(x)
        });
        bot.once('path_update', path => {
            //@ts-ignore
            if (!path.status === 'noPath') reject(new Error('No path to position found.'));
        }); 

    });
}

export function lookAtBlock(bot, block) {
    const dx = block.position.x + 0.5 - bot.entity.position.x;
    const dy = block.position.y + 0.5 - bot.entity.position.y;
    const dz = block.position.z + 0.5 - bot.entity.position.z;
  
    const distance = Math.sqrt(dx * dx + dz * dz);
    const yaw = Math.atan2(dz, dx) - Math.PI / 2;
    const pitch = Math.atan2(dy, distance);
  
    bot.look(yaw, pitch);
}