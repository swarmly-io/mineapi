import { Action, ActionParams } from "./Action";
import { Schematic } from 'prismarine-schematic';
import { Observation, Consequences } from "../types";
import { assertHas } from "../helpers/InventoryHelper";
import { NotEnoughItemsError } from "../errors/NotEnoughItemsError";
import { ActionDoResult } from "./types";
import { Vec3 } from 'vec3'
import { Build } from 'mineflayer-builder'
import interactable from 'mineflayer-builder/lib/interactable.json';
import { goals, Movements, pathfinder } from 'mineflayer-pathfinder';

import { Block } from 'prismarine-block'

export type BuildSchematicParams = {
    schematic: Schematic,
    position: Vec3
}

export class BuildSchematicAction extends Action<BuildSchematicParams> {

    build: Build
    movements: Movements

    constructor(params: ActionParams<BuildSchematicParams>) {
        super(params)
        this.build = new Build(params.schematic, this.bot.world, params.position)

        if (!this.bot.hasPlugin(pathfinder))
            this.bot.loadPlugin(pathfinder)

        this.movements = new Movements(this.bot, this.mcData)
        this.movements.digCost = 10
        this.movements.maxDropDown = 256
        // @ts-ignore
        this.bot.pathfinder.searchRadius = 10
    }

    async possible(observation: Observation): Promise<Consequences> {
        // Assuming the bot can perform all dig actions
        let requiredItems = this.build.actions.filter(a => a.type === 'place')
                                                .map(a => this.build.items[a.state])
                                                .filter(i => i !== undefined)
                                                .map(i => this.mcData.itemsByName[i.name])
                                                .reduce((p, i) => (p[i.id] = (p[i.id] ?? 0) + 1, p), {})

        Object.entries(requiredItems)
            .forEach(([key, value]) => {
                try {
                    assertHas(observation, value as number, key)
                } catch (e) {
                    if (e instanceof NotEnoughItemsError) {
                        return { success: false, reason: `BuildSchematic: Not enough items of type ${value}` }
                    }
                    else throw e
                }
            })

        //TODO: Bot will probably also use tools
        return {
            success: true,
            //@ts-ignore
            inventory: Object.fromEntries(Object.entries(requiredItems).map(([key, value]) => [key, -value]))
        }
    }

    async do(): Promise<ActionDoResult> {
        while (this.build.actions.length > 0) {
        const actions = this.build.getAvailableActions()
        console.log(`${actions.length} available actions`)
        if (actions.length === 0) {
            console.log('No actions to perform')
            break
        }
        actions.sort((a, b) => {
            const dA = a.pos.offset(0.5, 0.5, 0.5).distanceSquared(this.bot.entity.position)
            const dB = b.pos.offset(0.5, 0.5, 0.5).distanceSquared(this.bot.entity.position)
            return dA - dB
        })
        const action = actions[0]
        console.log('action', action)

        try {
            if (action.type === 'place') {
                const item = this.build.getItemForState(action.state)
                console.log('Selecting ' + item.displayName)

                const properties = this.build.properties[action.state]
                const half = properties.half ? properties.half : properties.type

                const faces = this.build.getPossibleDirections(action.state, action.pos)
                for (const face of faces) {
                    const block = this.bot.blockAt(action.pos.plus(face))
                    //@ts-ignore
                    console.log(face, action.pos.plus(face), block.name)
                }

                const { facing, is3D } = this.build.getFacing(action.state, properties.facing)
                const goal = new goals.GoalPlaceBlock(action.pos, this.bot.world, {
                    faces,
                    facing: facing,
                    //@ts-ignore
                    facing3D: is3D,
                    half
                })

                //@ts-ignore
                if (!goal.isEnd(this.bot.entity.position.floored())) {
                    console.log('pathfinding')
                    this.bot.pathfinder.setMovements(this.movements)
                    await this.bot.pathfinder.goto(goal)
                }

                try{
                    await this.equipItem(item.id) // equip item after pathfinder
                } catch (e: any) {
                    console.log(e)
                    return { reason: e.toString() }
                }

                // TODO: const faceAndRef = goal.getFaceAndRef(bot.entity.position.offset(0, 1.6, 0))
                //@ts-ignore
                const faceAndRef = goal.getFaceAndRef(this.bot.entity.position.floored().offset(0.5, 1.6, 0.5))
                if (!faceAndRef) { throw new Error('no face and ref') }

                await this.bot.lookAt(faceAndRef.to, true)

                const refBlock = this.bot.blockAt(faceAndRef.ref)
                const sneak = interactable.indexOf(refBlock!.name) > 0
                const delta = faceAndRef.to.minus(faceAndRef.ref)
                if (sneak) this.bot.setControlState('sneak', true)
                //@ts-ignore
                await this.bot._placeBlockWithOptions(refBlock, faceAndRef.face.scaled(-1), { half, delta })
                if (sneak) this.bot.setControlState('sneak', false)

                const block = this.bot.world.getBlock(action.pos)
                if (block.stateId !== action.state) {
                    console.log('expected', properties)
                    console.log('got', block.getProperties())
                }
            }
        } catch (e) {
            console.log(e)
        }

        this.build.removeAction(action)
        }

        return true
    }

    private async equipItem(id: number) {
        let item = this.bot.inventory.items().find(x => x.type === id)

        if (item === undefined) {
            throw new Error("Could not find item: " + this.mcData.items[id].name)
        }

        await this.bot.equip(item, 'hand')
    }
}
