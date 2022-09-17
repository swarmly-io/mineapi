import { observeInventory } from "../Observer"
import { Observation, Consequences, InventoryObservation } from "../types"
import { Action, ActionParams } from "./Action"
import { Vec3 } from 'vec3'
import { ActionDoResult } from "./types"

export type PlaceActionParams = {
    itemId: number,
    allowWalking?: boolean,
    allowedMaxDistance?: number
}

export class PlaceAction extends Action<PlaceActionParams> {

    constructor(params: ActionParams<PlaceActionParams>) {
        super(params)
    }

    async do(): Promise<ActionDoResult> {
        let block = this.getAvailableBlock()

        // @ts-ignore
        this.bot.equip(block.id, "hand")
        // @ts-ignore
        this.bot.placeBlock(this.bot.blockAt(this.bot.entity.position.offset(1, -1, 0)), new Vec3(0, 1, 0))
        // todo where is a good place to place a block?

        return true
    }

    async possible(observation: Observation): Promise<Consequences> {
        let value = false
        let reason: string | undefined = undefined
            try {
                value = !!this.getAvailableBlock(observation.inventory)
            } catch {
                value = false;
                reason = 'PlaceBlock: Block not in inventory'
            }

        let newInventory = !value ? 
                            observation.inventory.items : 
                            { ...observation.inventory.items, ...{ [this.options.itemId]: observation.inventory.items[this.options.itemId] - 1 } }
        
        return Promise.resolve({
            success: value,
            reason: reason,
            inventory: newInventory,
            position: observation.position,
            time: observation.time
        } as Consequences)
    }

    private findBlockAtVector({x, y, z}) {
        var targetPos = this.bot.entity.position.offset(0, this.bot.entity.height, 0);
        var block = this.bot.blockAt(targetPos);
        if (!block) return null
        while (block!.boundingBox === 'empty') {
          targetPos.translate(x, y, z);
          var block = this.bot.blockAt(targetPos);
        }
        
        return targetPos.floored().offset(0.5,0.5,0.5);
      }

    private getAvailableBlock(inventoryObservation : InventoryObservation | null = null) {
        let inventory = inventoryObservation ?? observeInventory(this.bot)
        let blockId = Object.keys(inventory.items).filter(x => Number(x) == this.options.itemId && inventory.items[x] > 0)[0]
        if (!blockId) {
            throw new Error("block not in inventory")
        }
        let block = this.mcData.blocks[blockId]
        return block
    }
}
