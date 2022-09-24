import { observeInventory, vec2key } from "../Observer"
import { Observation, Consequences, InventoryObservation } from "../types"
import { Action, ActionParams } from "./Action"
import { Vec3 } from 'vec3'
import { ActionDoResult } from "./types"
import { findBlocks, getBlockAt } from "../helpers/EnvironmentHelper"
import { goals } from "mineflayer-pathfinder"

export type PlaceActionParams = {
    itemId: number,
    radius?: number,
}

export type PlaceBlockPosition = { position: Vec3, face: Vec3 } | undefined;

export class PlaceAction extends Action<PlaceActionParams> {

    constructor(params: ActionParams<PlaceActionParams>) {
        params.radius = params.radius ?? 6
        super(params)
    }

    async do(): Promise<ActionDoResult> {
        let block;
        try{
            block = this.getAvailableBlock()
        } catch (e) {
            return { reason: 'PlaceBlock: Block not in inventory' }
        }

        let placePos = this.findBlockPosition()
        if (placePos === undefined) {
            return { reason: 'PlaceBlock: No position found to place the block' }
        }

        await this.bot.equip(this.options.itemId, "hand")
        //@ts-ignore
        await this.bot.pathfinder.goto(new goals.GoalPlaceBlock(placePos.position, this.bot.world, {
            range: 6
        }))
        try {
            await this.bot.placeBlock(this.bot.blockAt(placePos.position)!, placePos.face)
        } catch (e) { 
            // sometimes bot.placeBlock throws an exception, although the block appears to be placed correctly...
            // this needs to be fixed
            // `No block has been placed : the block is still ${oldBlock.name}`
        }

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

        let placePosition = this.findBlockPosition(observation)
        if (placePosition === undefined) {
            value = false
            reason = 'PlaceBlock: No position found to place the block'
        }

        let newInventory = !value ? 
                            observation.inventory.items : 
                            { ...observation.inventory.items, ...{ [this.options.itemId]: observation.inventory.items[this.options.itemId] - 1 } }
        
        return Promise.resolve({
            success: value,
            reason: reason,
            inventory: newInventory,
            position: observation.position,
            time: observation.time,
            world: placePosition !== undefined ?
                    {[vec2key(placePosition!.position)]: this.mcData.blocksByName[this.mcData.items[this.options.itemId].name].id} :
                    undefined
        } as Consequences)
    }

    // Returns any solid block with an airblock next to it
    private findBlockPosition(observation?: Observation): PlaceBlockPosition {
        const airIds = [this.mcData.blocksByName.air.id, this.mcData.blocksByName.cave_air.id] // There is also void_air, but it shouldn't be used for this
        var airBlocks = findBlocks(this.bot, 
                            airIds,
                            this.options.radius!, 10, observation)
        
        const offsets = [-1, 1]
        const neighborOffsets = [offsets.map(o => new Vec3(o, 0, 0)), offsets.map(o => new Vec3(0, o, 0)), offsets.map(o => new Vec3(0, 0, o))].flat()
        for(let block of airBlocks) {
            // check block faces for airblocks
            for (let offset of neighborOffsets) {
                let pos = block.plus(offset)
                let neighbor = getBlockAt(pos, this.bot, observation)
                
                if (neighbor !== undefined && airIds.includes(neighbor)) {
                    return {
                        position: block,
                        face: offset.scaled(-1)
                    }
                }
            }
        }
        return undefined
    }

    private getAvailableBlock(inventoryObservation : InventoryObservation | null = null) {
        let inventory = inventoryObservation ?? observeInventory(this.bot)
        let itemId = Object.keys(inventory.items).filter(x => Number(x) == this.options.itemId && inventory.items[x] > 0)[0]
        if (!itemId) {
            throw new Error("block not in inventory")
        }
        let block = this.mcData.blocksByName[this.mcData.items[itemId].name] // unfortunately itemIds and blockIds differ from each other
        return block
    }
}
