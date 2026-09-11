import { NotEnoughItemsError } from "../errors/NotEnoughItemsError"
import { assertHas } from "../helpers/InventoryHelper"
import { moveToPositionWithRetry, nudge } from "../helpers/TravelHelper"
import { observe } from "../Observer"
import { Observation } from "../types"
import { Vec3 } from "vec3"
import { Action, ActionAnalysisPredicate, ActionParams } from "./Action"
import { ActionState } from "./BotActionState"
import { ActionDoResult } from "./types"

export type MineBlockAtParams = {
    blockId?: number,
    expectedBlockId?: number,
    expectedBlockName?: string,
    expectedTool?: string,
    position?: Vec3,
    x?: number,
    y?: number,
    z?: number,
    allowedMaxDistance?: number,
}

export class MineBlockAtAction extends Action<MineBlockAtParams> {
    async do(possibleCheck: boolean = false, observation: Observation | undefined): Promise<ActionDoResult> {
        const position = this.options.position
            ? new Vec3(this.options.position.x, this.options.position.y, this.options.position.z)
            : new Vec3(this.options.x!, this.options.y!, this.options.z!)
        const expectedBlockId = this.options.expectedBlockId ?? this.options.blockId
        if (expectedBlockId === undefined || !Number.isInteger(position.x) || !Number.isInteger(position.y) || !Number.isInteger(position.z)) {
            return { reason: "MineBlockAt: exact integer coordinates and an expected block ID are required" }
        }
        const block = this.bot.blockAt(position)
        if (!block || block.type !== expectedBlockId || (this.options.expectedBlockName && block.name !== this.options.expectedBlockName)) {
            return { reason: "MineBlockAt: Expected block is not at the requested position" }
        }
        if (this.options.allowedMaxDistance !== undefined && this.bot.entity.position.distanceTo(position) > this.options.allowedMaxDistance) {
            return { reason: "MineBlockAt: Requested block exceeds reach/path constraint" }
        }

        if (block.harvestTools !== undefined) {
            try {
                assertHas(observation ?? await observe(this.bot), 1,
                    item => Object.keys(block.harvestTools!).includes(item as string))
            } catch (error) {
                if (error instanceof NotEnoughItemsError) {
                    return { reason: "MineBlockAt: No tool available to mine the requested block" }
                }
                throw error
            }
        }

        if (possibleCheck) return true

        try {
            await nudge(this.bot)
            await moveToPositionWithRetry(this.bot, position)
            const target = this.bot.blockAt(position)
            if (!target || target.type !== expectedBlockId || (this.options.expectedBlockName && target.name !== this.options.expectedBlockName) || !this.bot.canDigBlock(target)) {
                return { reason: "MineBlockAt: Cannot dig the requested block" }
            }
            await this.bot.tool.equipForBlock(target, { getFromChest: true })
            if (this.options.expectedTool && this.bot.heldItem?.name !== this.options.expectedTool) {
                return { reason: "MineBlockAt: Expected tool is unavailable" }
            }
            await this.bot.dig(target)
            return true
        } catch (error) {
            return { reason: `MineBlockAt: ${error instanceof Error ? error.message : String(error)}` }
        }
    }

    analyseFn(): ActionAnalysisPredicate {
        return (state: ActionState) => ({
            is_progressing: state.isDigging || state.isMoving,
            is_stuck: !state.isDigging && !state.isMoving
        })
    }
}
