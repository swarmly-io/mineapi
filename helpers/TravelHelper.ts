import { goals, Movements } from 'mineflayer-pathfinder';
import { Entity } from 'prismarine-entity';


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

export async function moveToPosition(bot, position) {
    return new Promise((resolve, reject) => {
        bot.pathfinder.setGoal(new goals.GoalNear(position.x, position.y, position.z, 1));

        bot.once('goal_reached', resolve);
        bot.once('goal_updated', reject);  // In case the goal is updated before reaching
        bot.once('path_update', path => {
            console.log('path_update', path)
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