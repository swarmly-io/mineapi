import { Vec3 } from 'vec3'
import { Entity } from 'prismarine-entity'


export type ItemsRecord = Record<string, number>

export type InventoryObservation = {
    items: ItemsRecord,
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
    inventory: InventoryObservation,
    world: Record<number, number> // Used to track world modifications for future chain states
}

export interface SuccessfulConsequences {
    success: true,    
    inventory?: ItemsRecord,
    time?: number,
    position?: Vec3,
    world?: Record<number, number>
}

export interface UnsuccessfulConsequences {
    success: false,
    reason: string,
}

export type Consequences = SuccessfulConsequences | UnsuccessfulConsequences

export type FailedChainResult = {
    index: number,
    reason: string
}