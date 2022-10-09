import { Observation, Consequences } from "../types"
import { Action, ActionParams } from "./Action"
import { ActionDoResult } from "./types"
import { Entity } from 'prismarine-entity'

export type FightActionParams = {
    entityName: string
    entityType: "player" | "mob" | "npc"
}

export class FightAction extends Action<FightActionParams> {

    constructor(params: ActionParams<FightActionParams>) {
        super(params)
    }

    async do(): Promise<ActionDoResult> {
        const { entityName, entityType } = this.options

        const entity = await this.nearestEntity(entityName, entityType)
        console.log(entity)

        if (this.isCanceled) {
            return {
                reason: "Action has been cancelled."
            }
        }
        await this.bot.pvp.attack(entity as unknown as Entity)
        
        return true
    }

    // todo - Multiple consequences -> E[X] Var[X]
    async possible(_: Observation): Promise<Consequences> {
        // is the entity near?
        // can the entity be defeated? -> not enough info from entity to decide
        // are there other entities around which will attack during the engagement
        // player has enough health, armour
        const { entityName, entityType } = this.options
        let success = false
        const entity = await this.nearestEntity(entityName, entityType)
        if (entity) {
            const concentration = await this.calculateEntityConcentration(entity)
            // todo if bot equiped with different items would be different
            // todo if each entity is equipped with different items would also be different
            if (concentration < 4) {
                success = true
            }
        }
       
        return success ? { success } : {
            success: success,
            reason: "Didn't meet criteria to fight"
        }
    }

    async calculateEntityConcentration(entity: Entity, minDistance: number = 5) {
        let count = 0
        for(let [x, e] of Object.entries(this.bot.entities)) {
            if (e.type !== entity.type) continue
            if (e.entityType !== entity.entityType) continue
            let distance = entity.position.distanceTo(e.position)
            if (distance <= minDistance) {
                count += 1
            }
        }
        return count
    }

    async nearestEntity(name: string, type: string) {
        let dist: number = 0
        let best: any | null = null;
        let bestDistance = 100;

        for(let [x, entity] of Object.entries(this.bot.entities)) {
          if(entity.type !== type) continue;
          
          if (type == 'player') {
            if (entity.username !== name) continue
          } else {
            if(entity.name !== name) continue
          }
          if(entity === this.bot.entity) continue

          dist = this.bot.entity.position.distanceTo(entity.position)
          if(!best || dist < bestDistance) {
            best = entity;
            bestDistance = dist;
          }
        }

        return best;
      }
}
