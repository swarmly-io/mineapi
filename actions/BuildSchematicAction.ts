import { Action, ActionParams } from "./Action";
import { Schematic } from 'prismarine-schematic';
import { Observation, Consequences } from "../types";
import { assertHas } from "../helpers/InventoryHelper";
import { NotEnoughItemsError } from "../errors/NotEnoughItemsError";
import { ActionDoResult } from "./types";
import { Vec3 } from 'vec3'
import { goals, Movements } from "mineflayer-pathfinder";

import { Block } from 'prismarine-block'

export type BuildSchematicParams = {
    schematic: Schematic
}

export class BuildSchematicAction extends Action<BuildSchematicParams> {

    ignoreBlocks: number[]
    movements: Movements

    constructor(params: ActionParams<BuildSchematicParams>) {
        super(params)

        this.ignoreBlocks = [this.mcData.blocksByName.air.id, this.mcData.blocksByName.cave_air.id]
        this.movements = new Movements(this.bot, this.mcData);
        this.movements.canDig = false
        this.movements.placeCost = 100000 // pathfinder should not place blocks
    }

    async possible(observation: Observation): Promise<Consequences> {
        

        //@ts-ignore
        let blocks = this.options.schematic.blocks.reduce((p, c) => (p[c] = (p[c] ?? 0) + 1, p), {})
        for (let [paletteEntry, count] of Object.entries(blocks)) {
            let stateId = this.options.schematic.palette[paletteEntry]
            //@ts-ignore
            let blockName = this.mcData.blocksByStateId[stateId].name
            let itemId = this.mcData.itemsByName[blockName].id
            try{
                assertHas(observation, count as number, itemId)
            } catch (e) {
                if (e instanceof NotEnoughItemsError) {
                    return { success: false, reason: `BuildSchematic: Not enough blocks of type ${itemId}` }
                }
                else throw e
            }
        }

        // TODO: Check that all blocks are air
        let startPos: Vec3 = this.options.schematic.start()
        let endPos: Vec3 = this.options.schematic.end()



        //TODO: Bot will probably also use tools
        return {
            success: true,
            //@ts-ignore
            inventory: Object.fromEntries(Object.entries(blocks).map(([key, value]) => [this.mcData.itemsByName[this.mcData.blocksByStateId[this.options.schematic.palette[key]].name].id, -value]))
        }
    }

    async do(): Promise<ActionDoResult> {
        
        let oldMovements = this.bot.pathfinder.movements
        this.bot.pathfinder.setMovements(this.movements)

        let startPos: Vec3 = this.options.schematic.start()
        let endPos: Vec3 = this.options.schematic.end()
        let size: Vec3 = this.options.schematic.size


        let blocksPerLayer = size.z * size.x
        let blocksPerRowZ = size.x

        for (let y = 0; y < size.y; y++) {
            for (let z = 0; z < size.z; z++) {
                for (let x = 0; x < size.x; x++) {

                    let idx = y * blocksPerLayer +  z * blocksPerRowZ + x
                    let paletteIndex = this.options.schematic.blocks[idx]
                    let blockState = this.options.schematic.palette[paletteIndex]
                    //@ts-ignore
                    let blockType = this.mcData.blocksByStateId[blockState]
                    
                    if (this.ignoreBlocks.includes(blockType.id))
                        continue

                    let pos = new Vec3(x, y, z).add(startPos)
                    let refBlock = this.findReferenceBlock(pos)

                    if (refBlock === undefined) {
                        this.bot.pathfinder.setMovements(oldMovements)
                        return {
                            reason: `BuildSchematic: Could not find a reference block for ${pos}`
                        }
                    }

                    if (pos.distanceSquared(this.bot.entity.position) > 36.0) {
                        //@ts-ignore
                        await this.bot.pathfinder.goto(new goals.GoalPlaceBlock(pos, this.bot.world, { range: 6 }))
                    }
                    try{
                        //@ts-ignore
                        await this.bot.equip(this.mcData.itemsByName[blockType.name].id, 'hand');
                        if (pos.floored() === this.bot.entity.position.floored()) {
                            this.bot.setControlState('jump', true)
                        }
                        await this.bot.placeBlock(refBlock[0], refBlock[1])
                    } catch (e) {
                        console.log(e)
                        throw e
                    }
                }
            }
        }
        this.bot.pathfinder.setMovements(oldMovements)

        return true
    }

    findReferenceBlock(pos: Vec3): [Block, Vec3] | undefined {
        const airIds = [this.mcData.blocksByName.air.id, this.mcData.blocksByName.cave_air.id] // There is also void_air, but it shouldn't be used for this
        
        const offsets = [-1, 1]
        const neighborOffsets = [offsets.map(o => new Vec3(o, 0, 0)), offsets.map(o => new Vec3(0, o, 0)), offsets.map(o => new Vec3(0, 0, o))].flat()
        for (let offset of neighborOffsets) {
            let bPos = pos.plus(offset)
            let neighbor = this.bot.blockAt(bPos)
            
            if (neighbor !== null && !airIds.includes(neighbor!.type)) {
                return [neighbor, offset.scaled(-1)]
            }
        }
        return undefined
    }
}
