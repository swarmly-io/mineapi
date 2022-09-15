import { Vec3 } from 'vec3'
import { Entity } from 'prismarine-entity'

export type InventoryObservation = {
    items: Record<number | string, number>,
    emptySlots: number
}

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
    inventory: InventoryObservation
}

export interface Consequences {
    success: boolean,
    inventory?: Record<number | string, number>,
}
