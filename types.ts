import { Vec3 } from 'vec3'
import { Entity } from 'prismarine-entity'


export interface Observation {
    position: Vec3,
    status: {
        health: number,
        food: number,
        saturation: number,
        oxygen: number
    },
    xp: number,
    time: number,
    weather: {
        isRaining: boolean,
        thunderLevel: number,
    },
    closeEntities: Entity[],
    inventory: {
        items: Record<number, number>,
        emptySlots: number
    }
}