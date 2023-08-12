import { Observation, Consequences } from "../types"
import { Action, ActionAnalysisPredicate, ActionParams } from "./Action"
import { ActionState } from "./BotActionState"
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

    async do(possibleCheck: boolean = false): Promise<ActionDoResult> {
        const { entityName, entityType } = this.options

        const entity = await this.nearestEntity(entityName, entityType)
        if (!entity) {
          return { reason: "No entity to fight was found" }
        }
        if (!possibleCheck) {
          this.bot.pvp.attack(entity as unknown as Entity)
        }
        
        return true
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

      analyseFn(): ActionAnalysisPredicate {
        return (state: ActionState) => ({
          is_progressing: state.isFighting || state.isMoving,
          is_stuck: !state.isFighting && !state.isMoving,
        });
      }
}
