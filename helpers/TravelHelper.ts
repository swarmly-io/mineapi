import { goals } from 'mineflayer-pathfinder';
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